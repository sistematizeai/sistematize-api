import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listServices(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .select('*, category:categories(id, name, color)')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getService(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .select('*, category:categories(id, name, color), collaborator_services(id, collaborator_id, commission, collaborator:collaborators(id, name))')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Servico nao encontrado.');
    throw error;
  }
  return data;
}

export async function createService(businessId: string, input: {
  name: string;
  category_id: string;
  description?: string;
  price?: number;
  price_type?: string;
  duration_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .insert({ business_id: businessId, ...input })
    .select('*, category:categories(id, name, color)')
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe um servico com esse nome nesta categoria.');
    if (error.code === '23503') throw new NotFoundError('Categoria nao encontrada.');
    throw error;
  }
  return data;
}

export async function updateService(id: string, businessId: string, input: {
  name?: string;
  category_id?: string;
  description?: string;
  price?: number;
  price_type?: string;
  duration_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('*, category:categories(id, name, color)')
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe um servico com esse nome nesta categoria.');
    if (error.code === 'PGRST116') throw new NotFoundError('Servico nao encontrado.');
    throw error;
  }
  return data;
}

export async function deleteService(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) throw error;
}
