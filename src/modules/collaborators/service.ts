import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { assertCanCreateCollaborator } from '../modules/access-control.js';

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
}, profileId?: string) {
  const supabase = getSupabaseAdmin();
  await assertCanCreateCollaborator(businessId, profileId);

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
    .eq('business_id', businessId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Colaborador nao encontrado.');
    throw error;
  }
}

export async function updateCollaboratorServices(
  collaboratorId: string,
  businessId: string,
  services: Array<{ service_id: string; commission?: number }>
) {
  const supabase = getSupabaseAdmin();

  const { data: collab, error: collabErr } = await supabase
    .from('collaborators')
    .select('id')
    .eq('id', collaboratorId)
    .eq('business_id', businessId)
    .single();

  if (collabErr || !collab) throw new NotFoundError('Colaborador nao encontrado.');

  if (services.length > 0) {
    const serviceIds = services.map(s => s.service_id);
    const { data: validServices } = await supabase
      .from('services').select('id').in('id', serviceIds).eq('business_id', businessId);
    if (!validServices || validServices.length !== serviceIds.length) {
      throw new NotFoundError('Um ou mais servicos nao foram encontrados.');
    }
  }

  const { error: delError } = await supabase
    .from('collaborator_services')
    .delete()
    .eq('collaborator_id', collaboratorId)
    .eq('business_id', businessId);

  if (delError) throw delError;

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

export async function getCollaboratorSchedule(collaboratorId: string, businessId: string) {
  const supabase = getSupabaseAdmin();

  const { data: collab } = await supabase
    .from('collaborators')
    .select('id, work_start, work_end')
    .eq('id', collaboratorId)
    .eq('business_id', businessId)
    .single();

  if (!collab) throw new NotFoundError('Colaborador nao encontrado.');

  const { data, error } = await supabase
    .from('collaborator_schedules')
    .select('*')
    .eq('collaborator_id', collaboratorId)
    .eq('business_id', businessId)
    .order('day_of_week', { ascending: true });

  if (error) throw error;

  const DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  const scheduleMap = new Map((data || []).map(s => [s.day_of_week, s]));

  return DAY_NAMES.map((name, i) => {
    const existing = scheduleMap.get(i);
    return {
      day_of_week: i,
      day_name: name,
      is_working: existing ? existing.is_working : (i >= 1 && i <= 5),
      work_start: existing?.work_start?.substring(0, 5) || collab.work_start?.substring(0, 5) || '08:00',
      work_end: existing?.work_end?.substring(0, 5) || collab.work_end?.substring(0, 5) || '18:00',
      lunch_start: existing?.lunch_start?.substring(0, 5) || null,
      lunch_end: existing?.lunch_end?.substring(0, 5) || null,
    };
  });
}

export async function updateCollaboratorSchedule(
  collaboratorId: string,
  businessId: string,
  schedules: Array<{
    day_of_week: number;
    is_working?: boolean;
    work_start?: string;
    work_end?: string;
    lunch_start?: string | null;
    lunch_end?: string | null;
  }>
) {
  const supabase = getSupabaseAdmin();

  const { data: collab } = await supabase
    .from('collaborators')
    .select('id')
    .eq('id', collaboratorId)
    .eq('business_id', businessId)
    .single();

  if (!collab) throw new NotFoundError('Colaborador nao encontrado.');

  for (const s of schedules) {
    if (s.work_start && s.work_end && s.work_start >= s.work_end) {
      throw new ValidationError(`Horario invalido no dia ${s.day_of_week}: inicio deve ser antes do fim.`);
    }
    if (s.lunch_start && s.lunch_end && s.lunch_start >= s.lunch_end) {
      throw new ValidationError(`Horario de almoco invalido no dia ${s.day_of_week}.`);
    }
  }

  for (const s of schedules) {
    const row = {
      business_id: businessId,
      collaborator_id: collaboratorId,
      day_of_week: s.day_of_week,
      is_working: s.is_working ?? true,
      work_start: s.work_start || '08:00',
      work_end: s.work_end || '18:00',
      lunch_start: s.lunch_start || null,
      lunch_end: s.lunch_end || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('collaborator_schedules')
      .upsert(row, { onConflict: 'collaborator_id,day_of_week' });

    if (error) throw error;
  }

  return getCollaboratorSchedule(collaboratorId, businessId);
}
