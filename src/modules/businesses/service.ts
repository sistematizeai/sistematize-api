import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

const SELECT_FIELDS = 'id, owner_id, name, slug, logo_url, phone, whatsapp, address, city, state, business_hours, plan_id, subscription_status, trial_ends_at, is_active, created_at, updated_at';

export async function getMyBusiness(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_FIELDS)
    .eq('id', businessId)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function updateMyBusiness(businessId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function listBusinesses(page = 1, limit = 20) {
  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('businesses')
    .select(SELECT_FIELDS, { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return { data: data || [], total: count || 0, page, limit };
}

export async function getBusinessById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function adminUpdateBusiness(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function updateBusinessStatus(id: string, status: string) {
  return adminUpdateBusiness(id, { subscription_status: status });
}

export async function blockExpiredTrials() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('businesses')
    .update({ subscription_status: 'blocked' })
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', now)
    .select('id, name');

  return { blocked: data?.length || 0, businesses: data || [] };
}
