import { getSupabaseAdmin } from '../../config/supabase.js';

export async function listAuditLogs(filters: {
  page?: number; limit?: number; entity_type?: string; action?: string;
}) {
  const supabase = getSupabaseAdmin();
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters.action) query = query.eq('action', filters.action);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: data || [], total: count || 0, page, limit };
}
