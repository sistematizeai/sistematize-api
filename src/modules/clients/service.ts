import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listClients(businessId: string, search?: string, page = 1, limit = 100) {
  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * limit;

  let query = supabase
    .from('clients')
    .select('*, appointments(id)', { count: 'exact' })
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    const safe = search.replace(/[%_\\(),."']/g, '');
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const clients = (data || []).map((c: any) => ({
    ...c,
    appointment_count: (c.appointments || []).length,
    appointments: undefined,
  }));

  return { data: clients, total: count || 0, page, limit };
}

export async function getClient(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (clientErr) {
    if (clientErr.code === 'PGRST116') throw new NotFoundError('Cliente nao encontrado.');
    throw clientErr;
  }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, appointment_services(*, service:services(name)), collaborator:collaborators(name)')
    .eq('client_id', id)
    .eq('business_id', businessId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  return { ...client, appointments: appointments || [] };
}

export async function createClient(businessId: string, input: {
  name: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  source?: string;
  notes?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .insert({ business_id: businessId, ...input })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe um cliente com esse telefone ou email.');
    throw error;
  }
  return data;
}

export async function updateClient(id: string, businessId: string, input: {
  name?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  source?: string;
  notes?: string;
  is_active?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe um cliente com esse telefone ou email.');
    if (error.code === 'PGRST116') throw new NotFoundError('Cliente nao encontrado.');
    throw error;
  }
  return data;
}

export async function deleteClient(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Cliente nao encontrado.');
    throw error;
  }
}

export async function findOrCreateClientByPhone(businessId: string, name: string, phone: string) {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', businessId)
    .eq('phone', phone)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('clients')
    .insert({ business_id: businessId, name, phone, source: 'public_page' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
