import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

export async function listPlans(includeInactive = false) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('plans')
    .select('*')
    .order('price_monthly', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPlan(input: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plans')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePlan(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Plano nao encontrado');
  return data;
}

export async function deactivatePlan(id: string) {
  return updatePlan(id, { is_active: false });
}
