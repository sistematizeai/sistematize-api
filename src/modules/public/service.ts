import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';
import { findOrCreateClientByPhone } from '../clients/service.js';
import { createAppointment } from '../appointments/service.js';

export async function getBusinessBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, slug, logo_url, phone, whatsapp, address, city, state, business_hours')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new NotFoundError('Salao nao encontrado.');
  return data;
}

export async function getPublicServices(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color, services(id, name, description, price, price_type, duration_minutes)')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (categories || []).map(cat => ({
    ...cat,
    services: (cat.services || []).filter((s: any) => s.duration_minutes > 0),
  })).filter(cat => cat.services.length > 0);
}

export async function createPublicBooking(slug: string, input: {
  client_name: string;
  client_phone: string;
  service_id: string;
  collaborator_id?: string;
  date: string;
  start_time: string;
  notes?: string;
}) {
  const business = await getBusinessBySlug(slug);
  const client = await findOrCreateClientByPhone(business.id, input.client_name, input.client_phone);

  let collaboratorId = input.collaborator_id;

  if (!collaboratorId) {
    const supabase = getSupabaseAdmin();
    const { data: collabSvc } = await supabase
      .from('collaborator_services')
      .select('collaborator_id, collaborator:collaborators(id, is_active)')
      .eq('service_id', input.service_id)
      .eq('business_id', business.id)
      .limit(1);

    const active = (collabSvc || []).find((cs: any) => cs.collaborator?.is_active);
    if (!active) throw new NotFoundError('Nenhum profissional disponivel para este servico.');
    collaboratorId = active.collaborator_id;
  }

  return createAppointment(business.id, {
    client_id: client.id,
    collaborator_id: collaboratorId,
    date: input.date,
    start_time: input.start_time,
    service_ids: [input.service_id],
    notes: input.notes,
    source: 'public_page',
  });
}
