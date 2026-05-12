import { getSupabaseAdmin } from '../../config/supabase.js';
import { loadEnv } from '../../config/env.js';
import { asaasRequest } from '../../utils/asaas-client.js';
import { NotFoundError, AppError } from '../../utils/errors.js';

type BillingCycle = 'monthly' | 'yearly';
type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

function getPlatformAsaas() {
  const env = loadEnv();
  if (!env.ASAAS_PLATFORM_API_KEY) {
    throw new AppError(503, 'Cobranca da plataforma nao configurada.', 'PLATFORM_BILLING_NOT_CONFIGURED');
  }
  return { apiKey: env.ASAAS_PLATFORM_API_KEY, environment: env.ASAAS_PLATFORM_ENV };
}

async function ensurePlatformCustomer(businessId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: biz, error } = await supabase
    .from('businesses')
    .select('id, name, platform_asaas_customer_id, owner_id')
    .eq('id', businessId)
    .single();

  if (error || !biz) throw new NotFoundError('Empresa nao encontrada.');

  if (biz.platform_asaas_customer_id) return biz.platform_asaas_customer_id;

  const { data: owner } = await supabase
    .from('profiles')
    .select('full_name, document, document_type, phone')
    .eq('id', biz.owner_id)
    .single();

  const { apiKey, environment } = getPlatformAsaas();
  const customer = await asaasRequest<{ id: string }>({
    apiKey,
    environment,
    path: '/customers',
    method: 'POST',
    body: {
      name: owner?.full_name || biz.name,
      cpfCnpj: owner?.document || undefined,
      phone: owner?.phone || undefined,
      externalReference: businessId,
    },
  });

  await supabase
    .from('businesses')
    .update({ platform_asaas_customer_id: customer.id })
    .eq('id', businessId);

  return customer.id;
}

export async function createSubscription(businessId: string, planId: string, billingCycle: BillingCycle, billingType: AsaasBillingType = 'UNDEFINED') {
  const supabase = getSupabaseAdmin();

  const existing = await getActiveSubscription(businessId);
  if (existing) {
    throw new AppError(409, 'Ja existe uma assinatura ativa. Cancele ou faca upgrade.', 'SUBSCRIPTION_EXISTS');
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .single();

  if (planError || !plan) throw new NotFoundError('Plano nao encontrado ou inativo.');

  const customerId = await ensurePlatformCustomer(businessId);
  const value = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);
  const dueDateStr = nextDueDate.toISOString().split('T')[0];

  const { apiKey, environment } = getPlatformAsaas();
  const sub = await asaasRequest<{
    id: string;
    status: string;
    nextDueDate: string;
  }>({
    apiKey,
    environment,
    path: '/subscriptions',
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      cycle,
      value,
      nextDueDate: dueDateStr,
      description: `Sistematize - Plano ${plan.name} (${billingCycle === 'yearly' ? 'anual' : 'mensal'})`,
      externalReference: businessId,
    },
  });

  const { data: record, error: insertError } = await supabase
    .from('platform_subscriptions')
    .insert({
      business_id: businessId,
      plan_id: planId,
      asaas_subscription_id: sub.id,
      billing_cycle: billingCycle,
      value,
      next_due_date: sub.nextDueDate || dueDateStr,
      status: 'active',
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  await supabase
    .from('businesses')
    .update({ plan_id: planId, subscription_status: 'active' })
    .eq('id', businessId);

  return { subscription: record, plan };
}

export async function getActiveSubscription(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('*, plan:plans(id, name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month)')
    .eq('business_id', businessId)
    .in('status', ['active', 'overdue'])
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upgradeSubscription(businessId: string, newPlanId: string, newBillingCycle?: BillingCycle) {
  const current = await getActiveSubscription(businessId);
  if (!current) throw new NotFoundError('Nenhuma assinatura ativa encontrada.');

  const supabase = getSupabaseAdmin();
  const { data: newPlan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', newPlanId)
    .eq('is_active', true)
    .single();

  if (planError || !newPlan) throw new NotFoundError('Plano nao encontrado ou inativo.');

  const billingCycle = newBillingCycle || current.billing_cycle;
  const newValue = billingCycle === 'yearly' ? newPlan.price_yearly : newPlan.price_monthly;
  const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

  const { apiKey, environment } = getPlatformAsaas();
  await asaasRequest({
    apiKey,
    environment,
    path: `/subscriptions/${current.asaas_subscription_id}`,
    method: 'PUT',
    body: {
      value: newValue,
      cycle,
      description: `Sistematize - Plano ${newPlan.name} (${billingCycle === 'yearly' ? 'anual' : 'mensal'})`,
    },
  });

  await supabase
    .from('platform_subscriptions')
    .update({ plan_id: newPlanId, billing_cycle: billingCycle, value: newValue })
    .eq('id', current.id);

  await supabase
    .from('businesses')
    .update({ plan_id: newPlanId })
    .eq('id', businessId);

  return { success: true, plan: newPlan, value: newValue, billing_cycle: billingCycle };
}

export async function cancelSubscription(businessId: string) {
  const current = await getActiveSubscription(businessId);
  if (!current) throw new NotFoundError('Nenhuma assinatura ativa encontrada.');

  const { apiKey, environment } = getPlatformAsaas();
  await asaasRequest({
    apiKey,
    environment,
    path: `/subscriptions/${current.asaas_subscription_id}`,
    method: 'DELETE',
  });

  const supabase = getSupabaseAdmin();
  await supabase
    .from('platform_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', current.id);

  await supabase
    .from('businesses')
    .update({ subscription_status: 'cancelled' })
    .eq('id', businessId);

  return { success: true };
}

export async function listInvoices(businessId: string, filters: { status?: string; page?: number; limit?: number }) {
  const supabase = getSupabaseAdmin();
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('platform_invoices')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .order('due_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count || 0, page, limit };
}

export async function getAvailablePlans() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function adminListSubscriptions(filters: { status?: string; page?: number; limit?: number }) {
  const supabase = getSupabaseAdmin();
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('platform_subscriptions')
    .select('*, plan:plans(id, name, price_monthly, price_yearly), business:businesses(id, name, slug)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count || 0, page, limit };
}

export async function adminGetRevenueStats() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { data: received } = await supabase
    .from('platform_invoices')
    .select('value')
    .in('status', ['confirmed', 'received'])
    .gte('paid_at', firstDayOfMonth);

  const { data: pending } = await supabase
    .from('platform_invoices')
    .select('value')
    .eq('status', 'pending');

  const { data: overdue } = await supabase
    .from('platform_invoices')
    .select('value')
    .eq('status', 'overdue');

  const { data: activeSubs } = await supabase
    .from('platform_subscriptions')
    .select('value')
    .eq('status', 'active');

  const sum = (rows: { value: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.value), 0);

  return {
    received_month: sum(received),
    pending_total: sum(pending),
    overdue_total: sum(overdue),
    mrr: sum(activeSubs),
    active_subscriptions: activeSubs?.length || 0,
    pending_count: pending?.length || 0,
    overdue_count: overdue?.length || 0,
  };
}
