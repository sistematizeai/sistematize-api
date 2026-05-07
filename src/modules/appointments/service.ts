import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export async function listAppointments(businessId: string, filters: {
  date?: string;
  status?: string;
  collaborator_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('appointments')
    .select('*, client:clients(id, name, phone), collaborator:collaborators(id, name), appointment_services(*, service:services(id, name))')
    .eq('business_id', businessId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (filters.date) query = query.eq('date', filters.date);
  if (filters.date_from) query = query.gte('date', filters.date_from);
  if (filters.date_to) query = query.lte('date', filters.date_to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.collaborator_id) query = query.eq('collaborator_id', filters.collaborator_id);

  const { data, error } = await query;
  if (error) throw error;
  return data;
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
    .in('service_id', input.service_ids);

  const enabledServiceIds = new Set((collabServices || []).map(cs => cs.service_id));
  const missingServices = input.service_ids.filter(id => !enabledServiceIds.has(id));
  if (missingServices.length > 0) {
    throw new ValidationError('Colaborador nao esta habilitado para todos os servicos selecionados.');
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);
  const endTime = addMinutesToTime(input.start_time, totalDuration);

  if (input.start_time < collaborator.work_start || endTime > collaborator.work_end) {
    throw new ValidationError('Horario fora da jornada do colaborador.');
  }

  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('collaborator_id', input.collaborator_id)
    .eq('date', input.date)
    .not('status', 'in', '("cancelled","no_show")')
    .lt('start_time', endTime)
    .gt('end_time', input.start_time);

  if (conflicts && conflicts.length > 0) {
    throw new ValidationError('Conflito de horario com outro agendamento do colaborador.');
  }

  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      client_id: input.client_id,
      collaborator_id: input.collaborator_id,
      date: input.date,
      start_time: input.start_time,
      end_time: endTime,
      total_price: totalPrice,
      total_duration: totalDuration,
      status: 'scheduled',
      notes: input.notes,
      source: input.source || 'dashboard',
    })
    .select()
    .single();

  if (aptErr) throw aptErr;

  const aptServices = services.map(s => ({
    business_id: businessId,
    appointment_id: appointment.id,
    service_id: s.id,
    price: s.price,
    duration_minutes: s.duration_minutes,
  }));

  await supabase.from('appointment_services').insert(aptServices);

  return appointment;
}

export async function updateAppointment(id: string, businessId: string, input: {
  collaborator_id?: string;
  date?: string;
  start_time?: string;
  notes?: string;
  payment_method?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('appointments')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Agendamento nao encontrado.');
    throw error;
  }
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
  return data;
}
