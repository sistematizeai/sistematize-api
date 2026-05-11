import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';

export async function listCategories(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createCategory(businessId: string, input: {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, ...input })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe uma categoria com esse nome.');
    throw error;
  }
  return data;
}

export async function updateCategory(id: string, businessId: string, input: {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new ConflictError('Ja existe uma categoria com esse nome.');
    if (error.code === 'PGRST116') throw new NotFoundError('Categoria nao encontrada.');
    throw error;
  }
  return data;
}

export async function deleteCategory(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (count && count > 0) {
    throw new ValidationError('Nao e possivel excluir uma categoria com servicos ativos. Desative ou mova os servicos primeiro.');
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Categoria nao encontrada.');
    throw error;
  }
}
