import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { sendAppointmentConfirmation, sendAppointmentCancellation } from '../notifications/service.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function normalizeTime(time: string): string {
  return time.substring(0, 5);
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export async function listAppointments(businessId: string, filters: {
  date?: string;
  status?: string;
  collaborator_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}) {
  const safeLimit = Math.min(filters.limit || 100, 100);
  const page = filters.page || 1;
  const offset = (page - 1) * safeLimit;
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('appointments')
    .select('*, client:clients(id, name, phone), collaborator:collaborators(id, name), appointment_services(*, service:services(id, name))', { count: 'exact' })
    .eq('business_id', businessId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .range(offset, offset + safeLimit - 1);

  if (filters.date) query = query.eq('date', filters.date);
  if (filters.date_from) query = query.gte('date', filters.date_from);
  if (filters.date_to) query = query.lte('date', filters.date_to);
  if (filters.status) {
    const statuses = filters.status.split(',');
    query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', filters.status);
  }
  if (filters.collaborator_id) query = query.eq('collaborator_id', filters.collaborator_id);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit: safeLimit };
}

export async function getAppointment(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('appointments')
    .select('*, client:clients(*), collaborator:collaborators(id, name), appointment_services(*, service:services(id, name, category_id))')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Agendamento nao encontrado.');
    throw error;
  }

  const { data: history } = await supabase
    .from('appointments')
    .select('id, date, start_time, end_time, total_price, status, appointment_services(service:services(name)), collaborator:collaborators(name)')
    .eq('client_id', data.client_id)
    .eq('business_id', businessId)
    .order('date', { ascending: false })
    .limit(20);

  return { ...data, client_history: history || [] };
}

export async function createAppointment(businessId: string, input: {
  client_id: string;
  collaborator_id: string;
  date: string;
  start_time: string;
  service_ids: string[];
  notes?: string;
  source?: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: services, error: svcErr } = await supabase
    .from('services')
    .select('id, price, duration_minutes, name')
    .in('id', input.service_ids)
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (svcErr) throw svcErr;
  if (!services || services.length !== input.service_ids.length) {
    throw new ValidationError('Um ou mais servicos nao foram encontrados ou estao inativos.');
  }

  const { data: collaborator, error: collabErr } = await supabase
    .from('collaborators')
    .select('id, work_start, work_end, is_active')
    .eq('id', input.collaborator_id)
    .eq('business_id', businessId)
    .single();

  if (collabErr || !collaborator) throw new NotFoundError('Colaborador nao encontrado.');
  if (!collaborator.is_active) throw new ValidationError('Colaborador esta inativo.');

  const { data: collabServices } = await supabase
    .from('collaborator_services')
    .select('service_id')
    .eq('collaborator_id', input.collaborator_id)
    .eq('is_active', true)
    .in('service_id', input.service_ids);

  const enabledServiceIds = new Set((collabServices || []).map(cs => cs.service_id));
  const missingServices = input.service_ids.filter(id => !enabledServiceIds.has(id));
  if (missingServices.length > 0) {
    throw new ValidationError('Colaborador nao esta habilitado para todos os servicos selecionados.');
  }

  const totalDuration = services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);
  const endTime = addMinutesToTime(input.start_time, totalDuration);

  const appointmentDate = new Date(input.date + 'T00:00:00');
  const dayOfWeek = appointmentDate.getUTCDay();

  const { data: daySchedule } = await supabase
    .from('collaborator_schedules')
    .select('is_working, work_start, work_end, lunch_start, lunch_end')
    .eq('collaborator_id', input.collaborator_id)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();

  const workStart = daySchedule?.work_start?.substring(0, 5) || normalizeTime(collaborator.work_start);
  const workEnd = daySchedule?.work_end?.substring(0, 5) || normalizeTime(collaborator.work_end);

  if (daySchedule && !daySchedule.is_working) {
    throw new ValidationError('Colaborador nao trabalha neste dia da semana.');
  }

  if (normalizeTime(input.start_time) < workStart || normalizeTime(endTime) > workEnd) {
    throw new ValidationError('Horario fora da jornada do colaborador.');
  }

  if (daySchedule?.lunch_start && daySchedule?.lunch_end) {
    const lunchStart = daySchedule.lunch_start.substring(0, 5);
    const lunchEnd = daySchedule.lunch_end.substring(0, 5);
    const aptStart = normalizeTime(input.start_time);
    const aptEnd = normalizeTime(endTime);
    if (aptStart < lunchEnd && aptEnd > lunchStart) {
      throw new ValidationError(`Horario conflita com o intervalo de almoco (${lunchStart} - ${lunchEnd}).`);
    }
  }

  const svcPayload = services.map(s => ({
    service_id: s.id,
    price: s.price,
    duration_minutes: s.duration_minutes,
  }));

  const { data: appointmentId, error: rpcErr } = await supabase.rpc('create_appointment_no_conflict', {
    p_business_id: businessId,
    p_client_id: input.client_id,
    p_collaborator_id: input.collaborator_id,
    p_date: input.date,
    p_start_time: input.start_time,
    p_end_time: endTime,
    p_total_price: totalPrice,
    p_total_duration: totalDuration,
    p_notes: input.notes || null,
    p_source: input.source || 'dashboard',
    p_services: svcPayload,
  });

  if (rpcErr) {
    if (rpcErr.message?.includes('APPOINTMENT_CONFLICT')) {
      throw new ValidationError('Conflito de horario com outro agendamento do colaborador.');
    }
    throw rpcErr;
  }

  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .select()
    .eq('id', appointmentId)
    .single();

  if (aptErr) throw aptErr;

  sendAppointmentConfirmation({ appointmentId: appointment.id, businessId }).catch(() => {});

  return appointment;
}

export async function updateAppointment(id: string, businessId: string, input: {
  collaborator_id?: string;
  date?: string;
  start_time?: string;
  notes?: string;
  payment_method?: string;
  cancel_reason?: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from('appointments')
    .select('status, total_duration, start_time, end_time, date, collaborator_id')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (fetchErr || !current) throw new NotFoundError('Agendamento nao encontrado.');

  const terminalStatuses = ['completed', 'cancelled', 'no_show'];
  if (terminalStatuses.includes(current.status)) {
    throw new ValidationError(`Nao e possivel editar um agendamento com status "${current.status}".`);
  }

  const needsReschedule = !!(input.start_time || input.date || input.collaborator_id);

  const finalDate = (input.date || current.date) as string;
  const finalStartTime = (input.start_time || current.start_time) as string;
  const finalEndTime = addMinutesToTime(finalStartTime, current.total_duration);
  const finalCollaboratorId = (input.collaborator_id || current.collaborator_id) as string;

  if (needsReschedule) {
    const { data: collab, error: collabErr } = await supabase
      .from('collaborators')
      .select('id, work_start, work_end, is_active')
      .eq('id', finalCollaboratorId)
      .eq('business_id', businessId)
      .single();

    if (collabErr || !collab) throw new NotFoundError('Colaborador nao encontrado.');
    if (!collab.is_active) throw new ValidationError('Colaborador esta inativo.');

    if (normalizeTime(finalStartTime) < normalizeTime(collab.work_start) || normalizeTime(finalEndTime) > normalizeTime(collab.work_end)) {
      throw new ValidationError('Horario fora da jornada do colaborador.');
    }

    const { error: rpcErr } = await supabase.rpc('update_appointment_no_conflict', {
      p_appointment_id: id,
      p_business_id: businessId,
      p_collaborator_id: finalCollaboratorId,
      p_date: finalDate,
      p_start_time: finalStartTime,
      p_end_time: finalEndTime,
      p_notes: input.notes || null,
      p_payment_method: input.payment_method || null,
      p_cancel_reason: input.cancel_reason || null,
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('APPOINTMENT_CONFLICT')) {
        throw new ValidationError('Conflito de horario com outro agendamento do colaborador.');
      }
      if (rpcErr.message?.includes('APPOINTMENT_NOT_FOUND')) {
        throw new NotFoundError('Agendamento nao encontrado.');
      }
      if (rpcErr.message?.includes('APPOINTMENT_TERMINAL_STATUS')) {
        throw new ValidationError(`Nao e possivel editar um agendamento com status terminal.`);
      }
      throw rpcErr;
    }
  } else {
    const updateData: Record<string, unknown> = {};
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.payment_method !== undefined) updateData.payment_method = input.payment_method;
    if (input.cancel_reason !== undefined) updateData.cancel_reason = input.cancel_reason;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) throw error;
    }
  }

  const { data, error: getErr } = await supabase
    .from('appointments')
    .select()
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (getErr) throw getErr;
  return data;
}

export async function updateStatus(id: string, businessId: string, newStatus: string) {
  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (fetchErr || !current) throw new NotFoundError('Agendamento nao encontrado.');

  if (current.status === newStatus) {
    const { data } = await supabase
      .from('appointments')
      .select()
      .eq('id', id)
      .eq('business_id', businessId)
      .single();
    return data;
  }

  const allowed = VALID_TRANSITIONS[current.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(`Transicao de "${current.status}" para "${newStatus}" nao e permitida.`);
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;

  if (newStatus === 'cancelled') {
    sendAppointmentCancellation({ appointmentId: id, businessId }).catch(() => {});
  }

  return data;
}
