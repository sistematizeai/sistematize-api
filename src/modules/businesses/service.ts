import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError } from '../../utils/errors.js';

const SELECT_FIELDS = '*';

async function enrichBusinesses(supabase: ReturnType<typeof getSupabaseAdmin>, businesses: Record<string, any>[]) {
  if (businesses.length === 0) return businesses;

  const ownerIds = [...new Set(businesses.map(b => b.owner_id).filter(Boolean))] as string[];
  const planIds = [...new Set(businesses.map(b => b.plan_id).filter(Boolean))] as string[];

  const [profilesResult, plansResult] = await Promise.all([
    ownerIds.length > 0
      ? supabase.from('profiles').select('id, full_name, document, document_type').in('id', ownerIds)
      : { data: [] as any[] },
    planIds.length > 0
      ? supabase.from('plans').select('id, name').in('id', planIds)
      : { data: [] as any[] },
  ]);

  const owners: Record<string, { full_name: string; document: string; document_type: string }> = {};
  for (const p of profilesResult.data || []) owners[p.id] = p;

  const emailResults = await Promise.all(
    ownerIds.map(id => supabase.auth.admin.getUserById(id)),
  );
  const emails: Record<string, string> = {};
  for (const r of emailResults) {
    if (r.data?.user) emails[r.data.user.id] = r.data.user.email || '';
  }

  const plans: Record<string, string> = {};
  for (const p of plansResult.data || []) plans[p.id] = p.name;

  return businesses.map(biz => ({
    ...biz,
    owner_name: owners[biz.owner_id]?.full_name || null,
    owner_email: emails[biz.owner_id] || null,
    owner_document: owners[biz.owner_id]?.document || null,
    owner_document_type: owners[biz.owner_id]?.document_type || null,
    plan_name: plans[biz.plan_id] || null,
  }));
}

export async function getMyBusiness(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_FIELDS)
    .eq('id', businessId)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function updateMyBusiness(businessId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function listBusinesses(page = 1, limit = 20, search?: string, status?: string) {
  const safeLimit = Math.min(limit, 100);
  const supabase = getSupabaseAdmin();
  const offset = (page - 1) * safeLimit;

  let query = supabase
    .from('businesses')
    .select(SELECT_FIELDS, { count: 'exact' })
    .range(offset, offset + safeLimit - 1)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('subscription_status', status);
  }

  if (search) {
    const safe = search.replace(/[%_\\(),."']/g, '');
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`);
    }
  }

  const { data: businesses, error, count } = await query;

  if (error) throw new Error(error.message);

  const items = businesses || [];
  const enriched = await enrichBusinesses(supabase, items);
  return { data: enriched, total: count || 0, page, limit: safeLimit };
}

export async function getBusinessById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  const [enriched] = await enrichBusinesses(supabase, [data]);
  return enriched;
}

export async function adminUpdateBusiness(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throw new NotFoundError('Negocio nao encontrado');
  return data;
}

export async function updateBusinessStatus(id: string, status: string) {
  return adminUpdateBusiness(id, { subscription_status: status });
}

export async function uploadBusinessImage(businessId: string, field: 'logo_url' | 'cover_image_url', fileBuffer: Buffer, mimeType: string) {
  const supabase = getSupabaseAdmin();
  const ext = mimeType.split('/')[1] || 'jpg';
  const label = field === 'logo_url' ? 'logo' : 'cover';
  const filePath = `${businessId}/${label}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('business-assets')
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('business-assets')
    .getPublicUrl(filePath);

  return updateMyBusiness(businessId, { [field]: urlData.publicUrl });
}

export async function getBusinessStats() {
  const supabase = getSupabaseAdmin();

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('subscription_status');

  if (error) throw new Error(error.message);

  const statusCounts: Record<string, number> = {};
  for (const b of businesses || []) {
    statusCounts[b.subscription_status] = (statusCounts[b.subscription_status] || 0) + 1;
  }

  return { totalBusinesses: (businesses || []).length, statusCounts };
}

export async function blockExpiredTrials() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('businesses')
    .update({ subscription_status: 'blocked' })
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', now)
    .select('id, name');

  return { blocked: data?.length || 0, businesses: data || [] };
}
