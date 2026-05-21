import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { findOrCreateClientByPhone } from '../clients/service.js';
import { createAppointment } from '../appointments/service.js';
import { getConnectionByBusinessId } from '../integrations/service.js';
import { createPayment } from '../asaas-payments/service.js';

type CollaboratorServiceRow = {
  collaborator_id: string;
  service_id: string;
  collaborator: {
    id: string;
    is_active: boolean;
    work_start: string | null;
    work_end: string | null;
  } | null;
};

type AppointmentInterval = {
  start_time: string;
  end_time: string;
};

type AvailableSlotsInput = {
  date: string;
  durationMinutes: number;
  workStart: string;
  workEnd: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  appointments: AppointmentInterval[];
  stepMinutes?: number;
};

export function assertPublicBookingEnabled(bookingEnabled: boolean) {
  if (!bookingEnabled) {
    throw new ValidationError('Agendamento online esta desativado para este estabelecimento.');
  }
}

export function assertPublicServiceActive(service: { id: string; is_active: boolean } | null | undefined) {
  if (!service) throw new NotFoundError('Servico nao encontrado.');
  if (!service.is_active) throw new ValidationError('Servico esta inativo.');
}

export function assertPublicCollaboratorActive(collaborator: { id: string; is_active: boolean } | null | undefined) {
  if (!collaborator) throw new NotFoundError('Colaborador nao encontrado.');
  if (!collaborator.is_active) throw new ValidationError('Colaborador esta inativo.');
}

function normalizeTime(time: string): string {
  return time.substring(0, 5);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = normalizeTime(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

export function buildAvailableSlots(input: AvailableSlotsInput): string[] {
  const step = input.stepMinutes || 30;
  const workStart = timeToMinutes(input.workStart);
  const workEnd = timeToMinutes(input.workEnd);
  const lunchStart = input.lunchStart ? timeToMinutes(input.lunchStart) : null;
  const lunchEnd = input.lunchEnd ? timeToMinutes(input.lunchEnd) : null;
  const appointments = input.appointments.map((appointment) => ({
    start: timeToMinutes(appointment.start_time),
    end: timeToMinutes(appointment.end_time),
  }));

  const slots: string[] = [];
  for (let start = workStart; start + input.durationMinutes <= workEnd; start += step) {
    const end = start + input.durationMinutes;
    if (lunchStart !== null && lunchEnd !== null && overlaps(start, end, lunchStart, lunchEnd)) continue;
    if (appointments.some((appointment) => overlaps(start, end, appointment.start, appointment.end))) continue;
    slots.push(minutesToTime(start));
  }

  return slots;
}

export async function getBusinessBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, slug, logo_url, cover_image_url, phone, whatsapp, address, city, state, business_hours, description, welcome_message, instagram, facebook, tiktok, primary_color, booking_enabled, booking_settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new NotFoundError('Salao nao encontrado.');

  const bs = (data as any).booking_settings as Record<string, unknown> | null;
  const { booking_settings: _, ...rest } = data as any;
  return {
    ...rest,
    hero_layout: (bs?.hero_layout as string) || 'split',
    show_hero_badges: bs?.show_hero_badges !== false,
  };
}

export async function getPublicServices(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color, services(id, name, description, price, price_type, duration_minutes, image_url, is_active, requires_payment, payment_type, deposit_amount)')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (categories || []).map(cat => ({
    ...cat,
    services: (cat.services || [])
      .filter((s: any) => s.is_active && s.duration_minutes > 0)
      .map(({ is_active, ...s }: any) => s),
  })).filter(cat => cat.services.length > 0);
}

export async function getPublicCombos(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data: combos } = await supabase
    .from('combos')
    .select('id, name, description, price, discount_percent, duration_minutes, image_url, combo_services(service:services(id, name, price, duration_minutes, is_active))')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (combos || []).map((combo: any) => {
    const services = (combo.combo_services || [])
      .map((cs: any) => cs.service)
      .filter((s: any) => s && s.is_active)
      .map(({ is_active, ...s }: any) => s);
    const computedDuration = services.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);
    const totalDuration = combo.duration_minutes || computedDuration;
    const originalPrice = services.reduce((sum: number, s: any) => sum + Number(s.price), 0);
    return {
      id: combo.id,
      name: combo.name,
      description: combo.description,
      price: Number(combo.price),
      original_price: originalPrice,
      discount_percent: Number(combo.discount_percent),
      image_url: combo.image_url,
      duration_minutes: totalDuration,
      services,
    };
  }).filter((c: any) => c.services.length > 0);
}

export async function getPublicAvailability(slug: string, input: {
  service_id?: string;
  combo_id?: string;
  collaborator_id?: string;
  date: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, booking_enabled')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!business) throw new NotFoundError('Salao nao encontrado.');
  assertPublicBookingEnabled(business.booking_enabled);

  const { serviceIds, durationMinutes } = await resolvePublicBookingServices(
    business.id,
    input.service_id,
    input.combo_id,
  );

  const { data: collaboratorServices } = await supabase
    .from('collaborator_services')
    .select('collaborator_id, service_id, collaborator:collaborators(id, name, is_active, work_start, work_end)')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .in('service_id', serviceIds);

  const collabMap = new Map<string, {
    collaborator: { id: string; name: string; is_active: boolean; work_start: string | null; work_end: string | null };
    serviceIds: Set<string>;
  }>();

  for (const row of collaboratorServices || []) {
    const collaborator = (row as any).collaborator;
    if (!collaborator?.is_active) continue;
    if (input.collaborator_id && collaborator.id !== input.collaborator_id) continue;
    const existing = collabMap.get(collaborator.id);
    if (existing) {
      existing.serviceIds.add((row as any).service_id);
    } else {
      collabMap.set(collaborator.id, {
        collaborator,
        serviceIds: new Set([(row as any).service_id]),
      });
    }
  }

  const date = new Date(`${input.date}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const collaborators = [];

  for (const entry of Array.from(collabMap.values()).filter((entry) => serviceIds.every((id: string) => entry.serviceIds.has(id)))) {
    const collaborator = entry.collaborator;
    const { data: schedule } = await supabase
      .from('collaborator_schedules')
      .select('is_working, work_start, work_end, lunch_start, lunch_end')
      .eq('business_id', business.id)
      .eq('collaborator_id', collaborator.id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (schedule && !schedule.is_working) {
      collaborators.push({ id: collaborator.id, name: collaborator.name, slots: [] });
      continue;
    }

    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('business_id', business.id)
      .eq('collaborator_id', collaborator.id)
      .eq('date', input.date)
      .not('status', 'in', '("cancelled","no_show")');

    const slots = buildAvailableSlots({
      date: input.date,
      durationMinutes,
      workStart: schedule?.work_start || collaborator.work_start || '08:00',
      workEnd: schedule?.work_end || collaborator.work_end || '18:00',
      lunchStart: schedule?.lunch_start || null,
      lunchEnd: schedule?.lunch_end || null,
      appointments: (appointments || []) as AppointmentInterval[],
      stepMinutes: 30,
    });

    collaborators.push({ id: collaborator.id, name: collaborator.name, slots });
  }

  return {
    date: input.date,
    duration_minutes: durationMinutes,
    service_ids: serviceIds,
    slots: Array.from(new Set(collaborators.flatMap((collaborator) => collaborator.slots))).sort(),
    collaborators,
  };
}

async function resolvePublicBookingServices(
  businessId: string,
  serviceId?: string,
  comboId?: string,
) {
  const supabase = getSupabaseAdmin();

  if (comboId) {
    const { data: combo, error } = await supabase
      .from('combos')
      .select('id, duration_minutes, is_active, combo_services(service_id, service:services(id, duration_minutes, is_active))')
      .eq('id', comboId)
      .eq('business_id', businessId)
      .single();

    if (error || !combo) throw new NotFoundError('Combo nao encontrado.');
    if (!combo.is_active) throw new ValidationError('Combo esta inativo.');

    const services = ((combo as any).combo_services || [])
      .map((row: any) => row.service)
      .filter((service: any) => service?.is_active);
    if (services.length === 0) throw new ValidationError('Combo nao possui servicos ativos.');

    return {
      serviceIds: services.map((service: any) => service.id),
      durationMinutes: combo.duration_minutes || services.reduce((sum: number, service: any) => sum + (service.duration_minutes || 0), 0),
    };
  }

  if (serviceId) {
    const { data: service, error } = await supabase
      .from('services')
      .select('id, duration_minutes, is_active')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .single();

    if (error || !service) throw new NotFoundError('Servico nao encontrado.');
    assertPublicServiceActive(service);

    return {
      serviceIds: [service.id],
      durationMinutes: service.duration_minutes || 30,
    };
  }

  throw new ValidationError('Informe service_id ou combo_id.');
}

export async function getClientData(slug: string, clientPhone: string) {
  const supabase = getSupabaseAdmin();

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!biz) throw new NotFoundError('Salao nao encontrado.');

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, phone, email, birth_date, source, notes, lgpd_consent_at, created_at')
    .eq('business_id', biz.id)
    .eq('phone', clientPhone)
    .single();

  if (!client) throw new NotFoundError('Nenhum cadastro encontrado com esse telefone.');

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, date, start_time, end_time, status, total_price, notes, created_at, appointment_services(service:services(name, price)), collaborator:collaborators(name)')
    .eq('client_id', client.id)
    .eq('business_id', biz.id)
    .order('date', { ascending: false })
    .limit(200);

  return {
    business_name: biz.name,
    personal_data: {
      name: client.name,
      phone: client.phone,
      email: client.email,
      birth_date: client.birth_date,
      source: client.source,
      notes: client.notes,
      lgpd_consent_at: client.lgpd_consent_at,
      registered_at: client.created_at,
    },
    appointments: (appointments || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      status: a.status,
      total_price: a.total_price,
      notes: a.notes,
      created_at: a.created_at,
      services: (a.appointment_services || []).map((as: any) => ({
        name: as.service?.name,
        price: as.service?.price,
      })),
      collaborator: a.collaborator?.name || null,
    })),
    exported_at: new Date().toISOString(),
  };
}

export async function deleteClientData(slug: string, clientPhone: string) {
  const supabase = getSupabaseAdmin();

  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!biz) throw new NotFoundError('Salao nao encontrado.');

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('business_id', biz.id)
    .eq('phone', clientPhone)
    .single();

  if (!client) throw new NotFoundError('Nenhum cadastro encontrado com esse telefone.');

  await supabase
    .from('appointments')
    .update({ notes: null })
    .eq('client_id', client.id)
    .eq('business_id', biz.id);

  await supabase
    .from('clients')
    .update({
      name: 'Cliente removido',
      phone: `deleted_${client.id.slice(0, 8)}`,
      email: null,
      birth_date: null,
      notes: null,
      is_active: false,
      lgpd_consent_at: null,
    })
    .eq('id', client.id);

  return { message: 'Dados anonimizados com sucesso.' };
}

export async function createPublicBooking(slug: string, input: {
  client_name: string;
  client_phone: string;
  client_email?: string;
  service_id?: string;
  combo_id?: string;
  collaborator_id?: string;
  date: string;
  start_time: string;
  notes?: string;
  lgpd_consent?: boolean;
}) {
  const supabaseForBiz = getSupabaseAdmin();
  const { data: bizRaw } = await supabaseForBiz
    .from('businesses')
    .select('id, name, slug, booking_enabled, booking_settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!bizRaw) throw new NotFoundError('Salao nao encontrado.');
  assertPublicBookingEnabled(bizRaw.booking_enabled);

  const bs = (bizRaw.booking_settings as Record<string, any>) || {};
  const minAdvanceHours = bs.min_advance_hours ?? 1;
  const maxAdvanceDays = bs.max_advance_days ?? 30;

  const appointmentDate = new Date(`${input.date}T${input.start_time}:00Z`);
  const now = new Date();
  const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < minAdvanceHours) {
    throw new ValidationError(`Agendamento deve ser feito com no minimo ${minAdvanceHours}h de antecedencia.`);
  }
  const daysUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil > maxAdvanceDays) {
    throw new ValidationError(`Agendamento nao pode ser feito com mais de ${maxAdvanceDays} dias de antecedencia.`);
  }

  const business = { id: bizRaw.id, name: bizRaw.name, slug: bizRaw.slug, booking_enabled: bizRaw.booking_enabled };

  const { serviceIds } = await resolvePublicBookingServices(
    business.id,
    input.service_id,
    input.combo_id,
  );

  if (input.collaborator_id) {
    const { data: collaborator, error } = await supabaseForBiz
      .from('collaborators')
      .select('id, is_active')
      .eq('id', input.collaborator_id)
      .eq('business_id', business.id)
      .single();

    if (error || !collaborator) throw new NotFoundError('Colaborador nao encontrado.');
    assertPublicCollaboratorActive(collaborator);
  }

  const client = await findOrCreateClientByPhone(business.id, input.client_name, input.client_phone, input.client_email, input.lgpd_consent);

  let collaboratorId = input.collaborator_id;

  if (!collaboratorId) {
    const supabase = getSupabaseAdmin();

    const { data: allCollabSvcs } = await supabase
      .from('collaborator_services')
      .select('collaborator_id, service_id, collaborator:collaborators(id, is_active, work_start, work_end)')
      .in('service_id', serviceIds)
      .eq('business_id', business.id);

    const collabMap = new Map<string, { collaborator: NonNullable<CollaboratorServiceRow['collaborator']>; serviceCount: number }>();
    const collaboratorServices = (allCollabSvcs || []) as unknown as CollaboratorServiceRow[];
    for (const cs of collaboratorServices) {
      if (!cs.collaborator?.is_active) continue;
      const existing = collabMap.get(cs.collaborator_id);
      if (existing) {
        existing.serviceCount++;
      } else {
        collabMap.set(cs.collaborator_id, { collaborator: cs.collaborator, serviceCount: 1 });
      }
    }

    const activeCollabs = Array.from(collabMap.entries())
      .filter(([, v]) => v.serviceCount === serviceIds.length)
      .map(([collabId, v]) => ({ collaborator_id: collabId, collaborator: v.collaborator }));

    if (activeCollabs.length === 0) throw new NotFoundError('Nenhum profissional disponivel para todos os servicos.');

    const { data: svcData } = await supabase
      .from('services')
      .select('duration_minutes')
      .in('id', serviceIds);
    const duration = (svcData || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 60;
    const startH = parseInt(input.start_time.split(':')[0], 10);
    const startM = parseInt(input.start_time.split(':')[1], 10);
    const endTotalMin = startH * 60 + startM + duration;
    const endTime = `${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`;

    for (const cs of activeCollabs) {
      const collab = cs.collaborator;
      if (collab.work_start && input.start_time < collab.work_start) continue;
      if (collab.work_end && endTime > collab.work_end) continue;

      const { data: conflicts } = await supabase
        .from('appointments')
        .select('id')
        .eq('collaborator_id', cs.collaborator_id)
        .eq('date', input.date)
        .not('status', 'in', '("cancelled","no_show")')
        .lt('start_time', endTime)
        .gt('end_time', input.start_time)
        .limit(1);

      if (!conflicts || conflicts.length === 0) {
        collaboratorId = cs.collaborator_id;
        break;
      }
    }

    if (!collaboratorId) throw new ValidationError('Nenhum profissional disponivel neste horario.');
  }

  const appointment = await createAppointment(business.id, {
    client_id: client.id,
    collaborator_id: collaboratorId,
    date: input.date,
    start_time: input.start_time,
    service_ids: serviceIds,
    notes: input.notes,
    source: 'public_page',
  });

  // Check if any service requires payment and Asaas is connected
  const supabasePayCheck = getSupabaseAdmin();
  const { data: paymentServices } = await supabasePayCheck
    .from('services')
    .select('id, price, requires_payment, payment_type, deposit_amount')
    .in('id', serviceIds)
    .eq('requires_payment', true);

  const requiresPayment = paymentServices && paymentServices.length > 0;
  let paymentData = null;

  if (requiresPayment) {
    const connection = await getConnectionByBusinessId(business.id);
    if (connection) {
      const primaryService = paymentServices[0];
      const paymentType = primaryService.payment_type || 'full_payment';

      let chargeValue = Number(appointment.total_price) || 0;
      if (paymentType === 'deposit' && primaryService.deposit_amount) {
        chargeValue = Number(primaryService.deposit_amount);
      }

      if (chargeValue > 0 && paymentType !== 'manual') {
        try {
          paymentData = await createPayment(business.id, {
            clientId: client.id,
            appointmentId: appointment.id,
            value: chargeValue,
            dueDate: input.date,
            billingType: 'UNDEFINED',
          });
        } catch {
          // Payment creation failed — appointment still valid, payment can be retried
        }
      }
    }
  }

  return {
    ...appointment,
    payment: paymentData ? {
      id: paymentData.id,
      status: paymentData.status,
      value: paymentData.value,
      billing_type: paymentData.billing_type,
      invoice_url: paymentData.invoice_url,
      pix_qr_code: paymentData.pix_qr_code,
      pix_payload: paymentData.pix_payload,
    } : null,
  };
}
