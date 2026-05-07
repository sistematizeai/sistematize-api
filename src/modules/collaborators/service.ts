import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

export async function listCollaborators(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('collaborators')
    .select('*, collaborator_services(id, service_id, commission, service:services(id, name, category_id))')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCollaborator(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('collaborators')
    .select('*, collaborator_services(id, service_id, commission, is_active, service:services(id, name, category_id, price, duration_minutes))')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Colaborador nao encontrado.');
    throw error;
  }
  return data;
}

export async function createCollaborator(businessId: string, input: {
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  base_commission?: number;
  work_start?: string;
  work_end?: string;
  notes?: string;
  is_active?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('collaborators')
    .insert({ business_id: businessId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCollaborator(id: string, businessId: string, input: {
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  base_commission?: number;
  work_start?: string;
  work_end?: string;
  notes?: string;
  is_active?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('collaborators')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Colaborador nao encontrado.');
    throw error;
  }
  return data;
}

export async function deleteCollaborator(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('collaborators')
    .update({ is_active: false })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) throw error;
}

export async function updateCollaboratorServices(
  collaboratorId: string,
  businessId: string,
  services: Array<{ service_id: string; commission?: number }>
) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('collaborator_services')
    .delete()
    .eq('collaborator_id', collaboratorId)
    .eq('business_id', businessId);

  if (services.length === 0) return [];

  const rows = services.map(s => ({
    business_id: businessId,
    collaborator_id: collaboratorId,
    service_id: s.service_id,
    commission: s.commission ?? null,
  }));

  const { data, error } = await supabase
    .from('collaborator_services')
    .insert(rows)
    .select('*, service:services(id, name)');

  if (error) throw error;
  return data;
}
