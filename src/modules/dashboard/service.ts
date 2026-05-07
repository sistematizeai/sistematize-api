import { getSupabaseAdmin } from '../../config/supabase.js';

export async function getStats(businessId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];

  const { count: totalAppointments } = await supabase
    .from('appointments').select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).gte('date', firstOfMonth);

  const { data: revenueData } = await supabase
    .from('appointments').select('total_price')
    .eq('business_id', businessId).eq('status', 'completed').gte('date', firstOfMonth);

  const revenue = (revenueData || []).reduce((sum, a) => sum + Number(a.total_price), 0);

  const { count: newClients } = await supabase
    .from('clients').select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).gte('created_at', firstOfMonth);

  const { count: noShows } = await supabase
    .from('appointments').select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).eq('status', 'no_show').gte('date', firstOfMonth);

  const noShowRate = totalAppointments && totalAppointments > 0
    ? Math.round(((noShows || 0) / totalAppointments) * 100)
    : 0;

  return {
    appointments: totalAppointments || 0,
    revenue,
    new_clients: newClients || 0,
    no_show_rate: noShowRate,
  };
}

export async function getUpcoming(businessId: string) {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select('id, date, start_time, status, client:clients(name), collaborator:collaborators(name), appointment_services(service:services(name))')
    .eq('business_id', businessId)
    .eq('date', today)
    .in('status', ['scheduled', 'confirmed'])
    .order('start_time', { ascending: true })
    .limit(10);

  if (error) throw error;
  return data;
}

export async function getCollaboratorPerformance(businessId: string) {
  const supabase = getSupabaseAdmin();
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const from = firstOfMonth.toISOString().split('T')[0];

  const { data: collaborators } = await supabase
    .from('collaborators')
    .select('id, name, avatar_url')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (!collaborators) return [];

  const results = [];
  for (const collab of collaborators) {
    const { data: apts } = await supabase
      .from('appointments')
      .select('total_price')
      .eq('collaborator_id', collab.id)
      .eq('status', 'completed')
      .gte('date', from);

    const count = apts?.length || 0;
    const revenue = (apts || []).reduce((sum, a) => sum + Number(a.total_price), 0);
    results.push({ ...collab, appointments_count: count, revenue });
  }

  return results.sort((a, b) => b.appointments_count - a.appointments_count);
}
