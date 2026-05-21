import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { assertCanCreateService } from '../modules/access-control.js';

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
  requires_payment?: boolean;
  payment_type?: string;
  deposit_amount?: number;
}, profileId?: string) {
  const supabase = getSupabaseAdmin();
  await assertCanCreateService(businessId, profileId);

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
  requires_payment?: boolean;
  payment_type?: string;
  deposit_amount?: number;
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

export async function uploadServiceImage(id: string, businessId: string, fileBuffer: Buffer, mimeType: string) {
  const supabase = getSupabaseAdmin();

  const ext = mimeType.split('/')[1] || 'jpg';
  const filePath = `${businessId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('service-images')
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('service-images')
    .getPublicUrl(filePath);

  const imageUrl = urlData.publicUrl;

  const { data, error } = await supabase
    .from('services')
    .update({ image_url: imageUrl })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('*, category:categories(id, name, color)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteService(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Servico nao encontrado.');
    throw error;
  }
}
