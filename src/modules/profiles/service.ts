import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

type InternalRole = 'sub_admin' | 'support' | 'finance' | 'commercial' | 'technical';

export type CreateInternalUserInput = {
  full_name: string;
  email: string;
  phone?: string;
  role: InternalRole | 'master_admin';
  permissions: string[];
  is_active?: boolean;
};

export function createTemporaryPassword() {
  return `Sis@${randomBytes(8).toString('hex')}`;
}

export async function getMyProfile(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, document, document_type, avatar_url, phone, role, business_id, is_active, totp_enabled, permissions, created_at')
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
  const safeLimit = Math.min(limit, 100);
  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * safeLimit;

  const { data, error, count } = await supabase
    .from('profiles')
    .select('id, full_name, document, document_type, role, business_id, is_active, permissions, created_at', { count: 'exact' })
    .range(offset, offset + safeLimit - 1)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const profiles = data || [];
  if (profiles.length === 0) return { data: profiles, total: count || 0, page, limit: safeLimit };

  const emailResults = await Promise.all(
    profiles.map(p => supabase.auth.admin.getUserById(p.id)),
  );
  const emails: Record<string, string> = {};
  for (const r of emailResults) {
    if (r.data?.user) emails[r.data.user.id] = r.data.user.email || '';
  }

  const enriched = profiles.map(p => ({ ...p, email: emails[p.id] || null }));
  return { data: enriched, total: count || 0, page, limit: safeLimit };
}

export async function adminUpdateProfile(profileId: string, updates: Record<string, unknown>) {
  if (updates.role === 'master_admin') {
    throw new ValidationError('Use o provisionamento seguro para master admin.');
  }
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

export async function createInternalUser(input: CreateInternalUserInput) {
  if (input.role === 'master_admin') {
    throw new ValidationError('Use o provisionamento seguro para master admin.');
  }

  const supabase = getSupabaseAdmin();
  const temporaryPassword = createTemporaryPassword();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });

  if (authError || !authData.user) {
    throw new ValidationError(authError?.message || 'Nao foi possivel criar usuario interno.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: input.full_name,
      phone: input.phone || null,
      role: input.role,
      permissions: input.permissions,
      business_id: null,
      is_active: input.is_active ?? true,
    })
    .select('id, full_name, phone, role, permissions, business_id, is_active, created_at')
    .single();

  if (error) throw error;
  return { ...data, email: authData.user.email, temporary_password: temporaryPassword };
}

export async function updateProfileStatus(profileId: string, isActive: boolean) {
  return adminUpdateProfile(profileId, { is_active: isActive });
}

export async function getProfileDetail(profileId: string) {
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, document, document_type, phone, role, business_id, is_active, permissions, totp_enabled, last_login_at, created_at')
    .eq('id', profileId)
    .single();

  if (error || !profile) throw new NotFoundError('Perfil nao encontrado');

  const [{ data: authUser }, businessResult, auditResult] = await Promise.all([
    supabase.auth.admin.getUserById(profileId),
    profile.business_id
      ? supabase
        .from('businesses')
        .select('id, name, slug, subscription_status, plan:plans(id, name), plan_modules(module:modules(id, name, slug)), user_modules(module:modules(id, name, slug), is_active)')
        .eq('id', profile.business_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const business = businessResult.data as any;
  const planModules = (business?.plan_modules || []).map((row: any) => row.module).filter(Boolean);
  const userModuleOverrides = (business?.user_modules || [])
    .filter((row: any) => row.is_active)
    .map((row: any) => row.module)
    .filter(Boolean);

  return {
    ...profile,
    email: authUser?.user?.email || null,
    business: business ? {
      id: business.id,
      name: business.name,
      slug: business.slug,
      subscription_status: business.subscription_status,
      plan: business.plan || null,
    } : null,
    modules: {
      plan: planModules,
      overrides: userModuleOverrides,
    },
    audit_logs: auditResult.data || [],
  };
}
