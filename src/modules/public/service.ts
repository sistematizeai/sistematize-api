import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { findOrCreateClientByPhone } from '../clients/service.js';
import { createAppointment } from '../appointments/service.js';

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
    .select('id, name, color, services(id, name, description, price, price_type, duration_minutes, image_url, is_active)')
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

export async function createPublicBooking(slug: string, input: {
  client_name: string;
  client_phone: string;
  service_id?: string;
  combo_id?: string;
  collaborator_id?: string;
  date: string;
  start_time: string;
  notes?: string;
}) {
  const supabaseForBiz = getSupabaseAdmin();
  const { data: bizRaw } = await supabaseForBiz
    .from('businesses')
    .select('id, name, slug, booking_enabled, booking_settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!bizRaw) throw new NotFoundError('Salao nao encontrado.');
  if (!bizRaw.booking_enabled) {
    throw new ValidationError('Agendamento online esta desativado para este estabelecimento.');
  }

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

  let serviceIds: string[] = [];

  if (input.combo_id) {
    const supabase = getSupabaseAdmin();
    const { data: combo, error } = await supabase
      .from('combos')
      .select('id, is_active, combo_services(service_id)')
      .eq('id', input.combo_id)
      .eq('business_id', business.id)
      .single();

    if (error || !combo) throw new NotFoundError('Combo nao encontrado.');
    if (!combo.is_active) throw new ValidationError('Combo esta inativo.');
    serviceIds = (combo.combo_services || []).map((cs: any) => cs.service_id);
    if (serviceIds.length === 0) throw new ValidationError('Combo nao possui servicos.');
  } else if (input.service_id) {
    serviceIds = [input.service_id];
  } else {
    throw new ValidationError('Informe service_id ou combo_id.');
  }

  const client = await findOrCreateClientByPhone(business.id, input.client_name, input.client_phone);

  let collaboratorId = input.collaborator_id;

  if (!collaboratorId) {
    const supabase = getSupabaseAdmin();

    const { data: allCollabSvcs } = await supabase
      .from('collaborator_services')
      .select('collaborator_id, service_id, collaborator:collaborators(id, is_active, work_start, work_end)')
      .in('service_id', serviceIds)
      .eq('business_id', business.id);

    const collabMap = new Map<string, { collaborator: any; serviceCount: number }>();
    for (const cs of (allCollabSvcs || [])) {
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

  return createAppointment(business.id, {
    client_id: client.id,
    collaborator_id: collaboratorId,
    date: input.date,
    start_time: input.start_time,
    service_ids: serviceIds,
    notes: input.notes,
    source: 'public_page',
  });
}
