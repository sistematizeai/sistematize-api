import { getSupabaseAdmin } from '../../config/supabase.js';

type Period = 'today' | '7d' | '30d';
type AppointmentRow = Record<string, unknown>;

export function parsePeriod(raw?: string): Period {
  if (raw === 'today' || raw === '7d' || raw === '30d') return raw;
  return '30d';
}

function getDateRange(period: Period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (period) {
    case 'today': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: today, to: today, prevFrom: yesterday.toISOString().split('T')[0], prevTo: yesterday.toISOString().split('T')[0] };
    }
    case '7d': {
      const from = new Date(now); from.setDate(now.getDate() - 6);
      const prevFrom = new Date(now); prevFrom.setDate(now.getDate() - 13);
      const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
      return { from: from.toISOString().split('T')[0], to: today, prevFrom: prevFrom.toISOString().split('T')[0], prevTo: prevTo.toISOString().split('T')[0] };
    }
    case '30d':
    default: {
      const from = new Date(now); from.setDate(now.getDate() - 29);
      const prevFrom = new Date(now); prevFrom.setDate(now.getDate() - 59);
      const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
      return { from: from.toISOString().split('T')[0], to: today, prevFrom: prevFrom.toISOString().split('T')[0], prevTo: prevTo.toISOString().split('T')[0] };
    }
  }
}

function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getStats(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const { from, to, prevFrom, prevTo } = getDateRange(period);

  const [appointmentsRes, completedRes, clientsRes, noShowsRes,
         prevAppRes, prevCompletedRes, prevClientsRes, prevNoShowsRes] = await Promise.all([
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).gte('date', from).lte('date', to),
    supabase.from('appointments').select('total_price')
      .eq('business_id', businessId).eq('status', 'completed').gte('date', from).lte('date', to),
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).gte('created_at', from)
      .lte('created_at', to + 'T23:59:59'),
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('status', 'no_show').gte('date', from).lte('date', to),
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).gte('date', prevFrom).lte('date', prevTo),
    supabase.from('appointments').select('total_price')
      .eq('business_id', businessId).eq('status', 'completed')
      .gte('date', prevFrom).lte('date', prevTo),
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).gte('created_at', prevFrom)
      .lte('created_at', prevTo + 'T23:59:59'),
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('status', 'no_show')
      .gte('date', prevFrom).lte('date', prevTo),
  ]);

  const totalAppointments = appointmentsRes.count || 0;
  const completedData = completedRes.data || [];
  const completedCount = completedData.length;
  const revenue = completedData.reduce((sum, a) => sum + Number(a.total_price), 0);
  const newClients = clientsRes.count || 0;
  const noShows = noShowsRes.count || 0;
  const noShowRate = totalAppointments > 0 ? Math.round((noShows / totalAppointments) * 100) : 0;
  const ticketMedio = completedCount > 0 ? Math.round((revenue / completedCount) * 100) / 100 : 0;

  const prevTotal = prevAppRes.count || 0;
  const prevCompletedData = prevCompletedRes.data || [];
  const prevCompletedCount = prevCompletedData.length;
  const prevRevenue = prevCompletedData.reduce((sum, a) => sum + Number(a.total_price), 0);
  const prevNewClients = prevClientsRes.count || 0;
  const prevNoShows = prevNoShowsRes.count || 0;
  const prevNoShowRate = prevTotal > 0 ? Math.round((prevNoShows / prevTotal) * 100) : 0;
  const prevTicketMedio = prevCompletedCount > 0 ? Math.round((prevRevenue / prevCompletedCount) * 100) / 100 : 0;

  return {
    appointments: totalAppointments,
    revenue,
    new_clients: newClients,
    no_show_rate: noShowRate,
    ticket_medio: ticketMedio,
    trends: {
      appointments: calcTrend(totalAppointments, prevTotal),
      revenue: calcTrend(revenue, prevRevenue),
      new_clients: calcTrend(newClients, prevNewClients),
      no_show_rate: calcTrend(noShowRate, prevNoShowRate),
      ticket_medio: calcTrend(ticketMedio, prevTicketMedio),
    },
  };
}

export async function getUpcoming(businessId: string) {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select('id, date, start_time, total_price, status, client:clients(name), collaborator:collaborators(name), appointment_services(service:services(name))')
    .eq('business_id', businessId)
    .eq('date', today)
    .in('status', ['scheduled', 'confirmed'])
    .order('start_time', { ascending: true })
    .limit(10);

  if (error) throw error;
  return data;
}

export async function getCollaboratorPerformance(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const { from, to } = getDateRange(period);

  const [{ data: collaborators }, { data: appointments }] = await Promise.all([
    supabase.from('collaborators').select('id, name, avatar_url')
      .eq('business_id', businessId).eq('is_active', true),
    supabase.from('appointments').select('collaborator_id, total_price')
      .eq('business_id', businessId).eq('status', 'completed').gte('date', from).lte('date', to),
  ]);

  if (!collaborators) return [];

  const apptsByCollab = new Map<string, { count: number; revenue: number }>();
  for (const apt of appointments || []) {
    const entry = apptsByCollab.get(apt.collaborator_id) || { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += Number(apt.total_price);
    apptsByCollab.set(apt.collaborator_id, entry);
  }

  return collaborators
    .map((collab) => {
      const stats = apptsByCollab.get(collab.id) || { count: 0, revenue: 0 };
      const ticket_medio = stats.count > 0 ? Math.round((stats.revenue / stats.count) * 100) / 100 : 0;
      return { ...collab, appointments_count: stats.count, revenue: stats.revenue, ticket_medio };
    })
    .sort((a, b) => b.appointments_count - a.appointments_count);
}

export async function getRevenueChart(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const days = period === '30d' ? 30 : period === 'today' ? 1 : 7;
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - (days - 1));
  const from = startDate.toISOString().split('T')[0];

  const today = now.toISOString().split('T')[0];

  const { data } = await supabase
    .from('appointments')
    .select('date, total_price')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .gte('date', from)
    .lte('date', today)
    .order('date', { ascending: true });

  const revenueByDay = new Map<string, number>();
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    revenueByDay.set(d.toISOString().split('T')[0], 0);
  }
  for (const row of data || []) {
    const day = String(row.date);
    revenueByDay.set(day, (revenueByDay.get(day) || 0) + Number(row.total_price));
  }

  return Array.from(revenueByDay.entries()).map(([date, revenue]) => ({ date, revenue }));
}

export async function getAppointmentsByStatus(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const { from, to } = getDateRange(period);

  const { data } = await supabase
    .from('appointments')
    .select('status')
    .eq('business_id', businessId)
    .gte('date', from)
    .lte('date', to);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const s = String(row.status);
    counts[s] = (counts[s] || 0) + 1;
  }

  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

export async function getPeakHours(businessId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);
  const from = thirtyDaysAgo.toISOString().split('T')[0];

  const today = now.toISOString().split('T')[0];

  const { data } = await supabase
    .from('appointments')
    .select('date, start_time, end_time')
    .eq('business_id', businessId)
    .in('status', ['completed', 'in_progress', 'confirmed', 'scheduled'])
    .gte('date', from)
    .lte('date', today);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const grid: Record<string, Record<number, number>> = {};
  for (const day of dayNames) {
    grid[day] = {};
    for (let h = 7; h <= 21; h++) grid[day][h] = 0;
  }

  for (const row of data || []) {
    const [y, m, d] = String(row.date).split('-').map(Number);
    const dayName = dayNames[new Date(y, m - 1, d).getDay()];
    const startH = parseInt(String(row.start_time).split(':')[0], 10);
    const endH = parseInt(String(row.end_time).split(':')[0], 10);
    for (let h = Math.max(startH, 7); h < Math.min(endH, 22); h++) {
      grid[dayName][h] = (grid[dayName][h] || 0) + 1;
    }
  }

  const maxCount = Math.max(1, ...Object.values(grid).flatMap((h) => Object.values(h)));

  return dayNames.map((day) => ({
    day,
    hours: Object.entries(grid[day])
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, count]) => ({
        hour: `${String(hour).padStart(2, '0')}:00`,
        count,
        percentage: Math.round((count / maxCount) * 100),
      })),
  }));
}

export async function getPopularServices(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const { from, to } = getDateRange(period);

  const { data } = await supabase
    .from('appointment_services')
    .select('service:services(name), appointment:appointments!inner(business_id, date)')
    .eq('appointment.business_id', businessId)
    .gte('appointment.date', from)
    .lte('appointment.date', to);

  const byService = new Map<string, number>();
  for (const row of (data || []) as Record<string, unknown>[]) {
    const svc = row.service as { name: string } | null;
    const name = svc?.name || 'Outro';
    byService.set(name, (byService.get(name) || 0) + 1);
  }

  return Array.from(byService.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function getDailyAppointments(businessId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  const from = sevenDaysAgo.toISOString().split('T')[0];

  const today = now.toISOString().split('T')[0];

  const { data } = await supabase
    .from('appointments')
    .select('date, status')
    .eq('business_id', businessId)
    .gte('date', from)
    .lte('date', today)
    .order('date', { ascending: true });
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const result: { date: string; label: string; total: number; completed: number; cancelled: number; is_today: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = dayNames[d.getDay()];

    const dayRows = (data || []).filter((r) => String(r.date) === dateStr);
    const completed = dayRows.filter((r) => r.status === 'completed').length;
    const cancelled = dayRows.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length;

    result.push({ date: dateStr, label: dayLabel, total: dayRows.length, completed, cancelled, is_today: dateStr === today });
  }

  return result;
}

export async function getRevenueByService(businessId: string, period: Period = '30d') {
  const supabase = getSupabaseAdmin();
  const { from, to } = getDateRange(period);

  const { data } = await supabase
    .from('appointment_services')
    .select('price, service:services(name), appointment:appointments!inner(business_id, status, date)')
    .eq('appointment.business_id', businessId)
    .eq('appointment.status', 'completed')
    .gte('appointment.date', from)
    .lte('appointment.date', to);

  const byService = new Map<string, number>();
  for (const row of (data || []) as AppointmentRow[]) {
    const svc = row.service as { name: string } | null;
    const name = svc?.name || 'Outro';
    byService.set(name, (byService.get(name) || 0) + Number(row.price));
  }

  return Array.from(byService.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}
