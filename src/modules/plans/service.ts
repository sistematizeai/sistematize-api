import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

export async function listPlans() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true });

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
