import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

export async function getMyProfile(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, document, document_type, avatar_url, phone, role, business_id, is_active, totp_enabled, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) throw new NotFoundError('Perfil nao encontrado');

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return { ...data, email: authUser?.user?.email || null };
}

export async function updateMyProfile(userId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Perfil nao encontrado');
  return data;
}

export async function listProfiles(page = 1, limit = 20) {
  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('profiles')
    .select('id, full_name, document, document_type, role, business_id, is_active, created_at', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const profiles = data || [];
  if (profiles.length === 0) return { data: profiles, total: count || 0, page, limit };

  const emailResults = await Promise.all(
    profiles.map(p => supabase.auth.admin.getUserById(p.id)),
  );
  const emails: Record<string, string> = {};
  for (const r of emailResults) {
    if (r.data?.user) emails[r.data.user.id] = r.data.user.email || '';
  }

  const enriched = profiles.map(p => ({ ...p, email: emails[p.id] || null }));
  return { data: enriched, total: count || 0, page, limit };
}

export async function adminUpdateProfile(profileId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Perfil nao encontrado');
  return data;
}
