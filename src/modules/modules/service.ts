import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listModules() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createModule(input: { name: string; slug: string; description?: string }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('modules')
    .insert(input)
    .select()
    .single();

  if (error?.code === '23505') throw new ConflictError('Modulo com este slug ja existe');
  if (error) throw new Error(error.message);
  return data;
}

export async function updateModule(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('modules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Modulo nao encontrado');
  return data;
}

export async function linkModuleToPlan(planId: string, moduleId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plan_modules')
    .insert({ plan_id: planId, module_id: moduleId })
    .select()
    .single();

  if (error?.code === '23505') throw new ConflictError('Modulo ja vinculado a este plano');
  if (error) throw new Error(error.message);
  return data;
}

export async function unlinkModuleFromPlan(planId: string, moduleId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('plan_modules')
    .delete()
    .eq('plan_id', planId)
    .eq('module_id', moduleId);

  if (error) throw new Error(error.message);
}

export async function createUserModuleOverride(input: {
  profile_id: string; module_id: string; business_id: string; is_active?: boolean; granted_by: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_modules')
    .upsert({
      profile_id: input.profile_id,
      module_id: input.module_id,
      business_id: input.business_id,
      is_active: input.is_active ?? true,
      granted_by: input.granted_by,
    }, { onConflict: 'profile_id,module_id,business_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
