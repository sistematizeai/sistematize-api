import { getSupabaseAdmin } from '../../config/supabase.js';
import { loadEnv } from '../../config/env.js';
import { asaasRequest } from '../../utils/asaas-client.js';
import { NotFoundError, AppError } from '../../utils/errors.js';

type BillingCycle = 'monthly' | 'yearly';
type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

type AsaasSubscriptionPayment = {
  id: string;
  status?: string;
  value?: number;
  netValue?: number | null;
  dueDate?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  billingType?: string | null;
};

type AsaasPixQrCode = {
  encodedImage?: string | null;
  payload?: string | null;
  expirationDate?: string | null;
};

type AsaasTokenizedCreditCard = {
  creditCardToken?: string | null;
  token?: string | null;
  creditCardBrand?: string | null;
  brand?: string | null;
  creditCardNumber?: string | null;
  last4?: string | null;
};

type CreditCardInput = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

type CreditCardHolderInfoInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
};

type CheckoutCardPaymentInput = {
  creditCard: CreditCardInput;
  holderInfo: CreditCardHolderInfoInput;
};

type PlanLimits = {
  max_collaborators?: number | null;
  max_services?: number | null;
  max_appointments_month?: number | null;
};

type UsageSnapshot = {
  collaborators: number;
  services: number;
  appointmentsThisMonth: number;
};

type BusinessSubscriptionStatus = 'trial' | 'active' | 'paid' | 'overdue' | 'cancelled' | 'blocked';
type PlanChangeType = 'upgrade' | 'downgrade' | 'same';
type PlatformSubscriptionStatus = 'pending_payment' | 'active' | 'overdue' | 'past_due' | 'cancel_at_period_end';

const CURRENT_SUBSCRIPTION_STATUSES: PlatformSubscriptionStatus[] = [
  'pending_payment',
  'active',
  'overdue',
  'past_due',
  'cancel_at_period_end',
];

const RETRYABLE_INVOICE_STATUSES = ['pending', 'overdue', 'refused'];
const PAYABLE_INVOICE_STATUSES = RETRYABLE_INVOICE_STATUSES;
const BILLING_RETRY_DELAYS_DAYS = [1, 3, 5];
const SECRET_METADATA_KEYS = new Set([
  'creditCardToken',
  'credit_card_token',
  'asaas_credit_card_token',
  'ccv',
  'cvv',
  'cardNumber',
  'card_number',
  'number',
]);

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

function validateSubscriptionValue(value: number) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new AppError(422, 'Valor do plano invalido para cobranca da plataforma.', 'INVALID_PLAN_VALUE');
  }
}

export function getAsaasPaymentUrl(payment: Pick<AsaasSubscriptionPayment, 'invoiceUrl' | 'bankSlipUrl'> | null | undefined) {
  return payment?.invoiceUrl || payment?.bankSlipUrl || null;
}

export function getCurrentSubscriptionStatuses() {
  return [...CURRENT_SUBSCRIPTION_STATUSES];
}

export function normalizePlatformInvoiceStatus(asaasStatus: string | null | undefined) {
  const map: Record<string, string> = {
    PENDING: 'pending',
    RECEIVED: 'received',
    CONFIRMED: 'confirmed',
    OVERDUE: 'overdue',
    REFUNDED: 'refunded',
    DELETED: 'deleted',
    CANCELLED: 'cancelled',
    RECEIVED_IN_CASH: 'received',
    pending: 'pending',
    received: 'received',
    confirmed: 'confirmed',
    overdue: 'overdue',
    refunded: 'refunded',
    deleted: 'deleted',
    cancelled: 'cancelled',
  };
  return map[asaasStatus || ''] || 'pending';
}

export function buildPlatformInvoiceRecord(input: {
  businessId: string;
  subscriptionId: string;
  payment: AsaasSubscriptionPayment;
  fallbackValue: number;
  fallbackDueDate: string;
  requestedBillingType: AsaasBillingType;
}) {
  return {
    business_id: input.businessId,
    subscription_id: input.subscriptionId,
    asaas_payment_id: input.payment.id,
    value: input.payment.value || input.fallbackValue,
    net_value: input.payment.netValue || null,
    status: normalizePlatformInvoiceStatus(input.payment.status),
    due_date: input.payment.dueDate || input.fallbackDueDate,
    invoice_url: input.payment.invoiceUrl || null,
    bank_slip_url: input.payment.bankSlipUrl || null,
    billing_type: input.payment.billingType || input.requestedBillingType,
  };
}

export function buildSubscriptionCheckoutUrl(invoiceId: string) {
  return `/dashboard/checkout/${invoiceId}`;
}

export function buildPendingInvoiceCheckoutResponse(invoice: { id: string; invoice_url?: string | null; bank_slip_url?: string | null }) {
  return {
    reused: true,
    pending: true,
    payment_url: getAsaasPaymentUrl({
      invoiceUrl: invoice.invoice_url || null,
      bankSlipUrl: invoice.bank_slip_url || null,
    }),
    checkout_url: buildSubscriptionCheckoutUrl(invoice.id),
    invoice,
  };
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function trimText(value: string | null | undefined) {
  return String(value || '').trim();
}

function normalizeExpiryMonth(value: string) {
  const digits = onlyDigits(value).slice(0, 2);
  return digits.length === 1 ? digits.padStart(2, '0') : digits;
}

function normalizeExpiryYear(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length === 2) return `20${digits}`;
  return digits;
}

export function normalizeCheckoutCardPaymentInput(input: CheckoutCardPaymentInput): CheckoutCardPaymentInput {
  return {
    creditCard: {
      holderName: trimText(input.creditCard.holderName),
      number: onlyDigits(input.creditCard.number),
      expiryMonth: normalizeExpiryMonth(input.creditCard.expiryMonth),
      expiryYear: normalizeExpiryYear(input.creditCard.expiryYear),
      ccv: onlyDigits(input.creditCard.ccv).slice(0, 4),
    },
    holderInfo: {
      name: trimText(input.holderInfo.name),
      email: trimText(input.holderInfo.email).toLowerCase(),
      cpfCnpj: onlyDigits(input.holderInfo.cpfCnpj),
      postalCode: onlyDigits(input.holderInfo.postalCode),
      addressNumber: trimText(input.holderInfo.addressNumber),
      phone: input.holderInfo.phone ? onlyDigits(input.holderInfo.phone) : undefined,
    },
  };
}

function resolveTokenizedCardLast4(tokenization: AsaasTokenizedCreditCard, rawCardNumber?: string) {
  const fromAsaas = onlyDigits(tokenization.creditCardNumber || tokenization.last4);
  const fromRaw = onlyDigits(rawCardNumber);
  return (fromAsaas || fromRaw).slice(-4) || null;
}

function resolveCreditCardToken(tokenization: AsaasTokenizedCreditCard) {
  const token = tokenization.creditCardToken || tokenization.token;
  if (!token) {
    throw new AppError(502, 'Asaas nao retornou o token do cartao.', 'ASAAS_CARD_TOKEN_MISSING');
  }
  return token;
}

export function buildStoredPaymentMethodRecord(input: {
  businessId: string;
  customerId: string;
  tokenization: AsaasTokenizedCreditCard;
  holderName: string;
  rawCardNumber?: string;
}) {
  return {
    business_id: input.businessId,
    customer_id: input.customerId,
    asaas_credit_card_token: resolveCreditCardToken(input.tokenization),
    holder_name: input.holderName,
    card_brand: input.tokenization.creditCardBrand || input.tokenization.brand || null,
    card_last4: resolveTokenizedCardLast4(input.tokenization, input.rawCardNumber),
    status: 'active',
    is_default: true,
  };
}

export function buildAsaasSubscriptionCardUpdatePayload(creditCardToken: string, remoteIp?: string) {
  return {
    creditCardToken,
    ...(remoteIp ? { remoteIp } : {}),
  };
}

export function sanitizePaymentMethodForClient(method: Record<string, any>) {
  return {
    id: method.id,
    holder_name: method.holder_name || null,
    card_brand: method.card_brand || null,
    card_last4: method.card_last4 || null,
    is_default: Boolean(method.is_default),
    status: method.status || 'active',
    created_at: method.created_at,
    updated_at: method.updated_at,
    last_used_at: method.last_used_at || null,
  };
}

export function calculateBillingRetrySchedule(currentRetryCount: number, now = new Date().toISOString()) {
  const retryCount = Math.min(Math.max(0, Number(currentRetryCount) || 0) + 1, BILLING_RETRY_DELAYS_DAYS.length);
  const exhausted = Number(currentRetryCount || 0) >= BILLING_RETRY_DELAYS_DAYS.length;
  if (exhausted) {
    return { retry_count: BILLING_RETRY_DELAYS_DAYS.length, next_retry_at: null, exhausted: true };
  }

  const delayDays = BILLING_RETRY_DELAYS_DAYS[retryCount - 1];
  const nextRetry = new Date(now);
  nextRetry.setUTCDate(nextRetry.getUTCDate() + delayDays);
  return { retry_count: retryCount, next_retry_at: nextRetry.toISOString(), exhausted: false };
}

function sanitizeBillingMetadata(metadata: Record<string, any> | null | undefined): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SECRET_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBillingMetadata(value as Record<string, any>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function buildBillingEventRecord(input: {
  businessId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  paymentMethodId?: string | null;
  eventType: string;
  severity?: 'info' | 'warn' | 'error';
  message?: string | null;
  metadata?: Record<string, any> | null;
}) {
  return {
    business_id: input.businessId,
    subscription_id: input.subscriptionId || null,
    invoice_id: input.invoiceId || null,
    payment_method_id: input.paymentMethodId || null,
    event_type: input.eventType,
    severity: input.severity || 'info',
    message: input.message || null,
    metadata: sanitizeBillingMetadata(input.metadata),
  };
}

async function recordBillingEvent(input: Parameters<typeof buildBillingEventRecord>[0]) {
  const supabase = getSupabaseAdmin();
  try {
    await supabase.from('platform_billing_events').insert(buildBillingEventRecord(input));
  } catch {
    // Billing should not fail because audit storage is unavailable during deploy rollout.
  }
}

async function attachCreditCardTokenToAsaasSubscription(asaasSubscriptionId: string | null | undefined, creditCardToken: string, remoteIp?: string) {
  if (!asaasSubscriptionId) return { attached: false, reason: 'missing_subscription' };
  const { apiKey, environment } = getPlatformAsaas();
  await asaasRequest({
    apiKey,
    environment,
    path: `/subscriptions/${asaasSubscriptionId}/creditCard`,
    method: 'PUT',
    body: buildAsaasSubscriptionCardUpdatePayload(creditCardToken, remoteIp),
  });
  return { attached: true };
}

async function getSubscriptionForInvoice(invoice: any) {
  if (!invoice.subscription_id) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('id, business_id, plan_id, asaas_subscription_id')
    .eq('id', invoice.subscription_id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getDefaultPaymentMethod(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_payment_methods')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_default', true)
    .eq('status', 'active')
    .is('disabled_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function buildImmediatePaidCheckoutEffects(input: {
  invoice: { purpose?: string | null; pending_plan_id?: string | null; subscription_id?: string | null };
  subscription: { id: string; business_id: string; plan_id: string } | null;
}) {
  if (!input.invoice.subscription_id || !input.subscription) {
    return { action: 'none' as const };
  }

  if (input.invoice.purpose === 'plan_change' && input.invoice.pending_plan_id) {
    return {
      action: 'apply_pending_plan_change' as const,
      subscription_id: input.invoice.subscription_id,
    };
  }

  return {
    action: 'activate_subscription' as const,
    subscription_id: input.subscription.id,
    business_id: input.subscription.business_id,
    plan_id: input.subscription.plan_id,
  };
}

async function upsertPlatformInvoice(record: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_invoices')
    .upsert(record, { onConflict: 'asaas_payment_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getLatestPayableInvoice(subscriptionId: string, filters?: {
  purpose?: string;
  pendingPlanId?: string;
  pendingBillingCycle?: BillingCycle;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('platform_invoices')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .in('status', PAYABLE_INVOICE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);

  if (filters?.purpose) query = query.eq('purpose', filters.purpose);
  if (filters?.pendingPlanId) query = query.eq('pending_plan_id', filters.pendingPlanId);
  if (filters?.pendingBillingCycle) query = query.eq('pending_billing_cycle', filters.pendingBillingCycle);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function insertPlatformSubscriptionRecord(input: {
  businessId: string;
  planId: string;
  asaasSubscriptionId: string;
  billingCycle: BillingCycle;
  value: number;
  nextDueDate: string;
}) {
  const supabase = getSupabaseAdmin();
  const baseRecord = {
    business_id: input.businessId,
    plan_id: input.planId,
    asaas_subscription_id: input.asaasSubscriptionId,
    billing_cycle: input.billingCycle,
    value: input.value,
    next_due_date: input.nextDueDate,
  };

  const firstAttempt = await supabase
    .from('platform_subscriptions')
    .insert({ ...baseRecord, status: 'pending_payment' })
    .select('*')
    .single();

  if (!firstAttempt.error) return firstAttempt.data;

  if ((firstAttempt.error as { code?: string }).code !== '23514') {
    throw firstAttempt.error;
  }

  const fallback = await supabase
    .from('platform_subscriptions')
    .insert({ ...baseRecord, status: 'active' })
    .select('*')
    .single();

  if (fallback.error) throw fallback.error;
  return fallback.data;
}

export function resolveBusinessStatusAfterSubscriptionCreated(
  currentStatus: BusinessSubscriptionStatus,
): BusinessSubscriptionStatus {
  if (['blocked', 'overdue', 'cancelled', 'trial'].includes(currentStatus)) {
    return currentStatus;
  }

  return 'active';
}

function roundCurrency(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

export function isRetryablePlatformInvoiceStatus(status: string | null | undefined) {
  return Boolean(status && RETRYABLE_INVOICE_STATUSES.includes(status.toLowerCase()));
}

export function buildAdminBillingOperationsSummary(input: {
  invoices: Array<{
    status?: string | null;
    value?: number | string | null;
    retry_count?: number | string | null;
    next_retry_at?: string | null;
  }>;
  events: Array<{ severity?: string | null }>;
  paymentMethods: Array<{ failed_attempts?: number | string | null }>;
  now?: string;
}) {
  const nowMs = input.now ? new Date(input.now).getTime() : Date.now();
  const retryableInvoices = input.invoices.filter(invoice => isRetryablePlatformInvoiceStatus(invoice.status));

  return {
    open_amount: roundCurrency(retryableInvoices.reduce((sum, invoice) => sum + Number(invoice.value || 0), 0)),
    retryable_count: retryableInvoices.length,
    pending_count: input.invoices.filter(invoice => invoice.status === 'pending').length,
    overdue_count: input.invoices.filter(invoice => invoice.status === 'overdue').length,
    refused_count: input.invoices.filter(invoice => invoice.status === 'refused').length,
    exhausted_retry_count: retryableInvoices.filter(invoice => Number(invoice.retry_count || 0) >= BILLING_RETRY_DELAYS_DAYS.length).length,
    due_retry_count: retryableInvoices.filter(invoice => {
      if (!invoice.next_retry_at) return false;
      return new Date(invoice.next_retry_at).getTime() <= nowMs;
    }).length,
    warning_event_count: input.events.filter(event => event.severity === 'warn').length,
    error_event_count: input.events.filter(event => event.severity === 'error').length,
    failing_payment_method_count: input.paymentMethods.filter(method => Number(method.failed_attempts || 0) > 0).length,
  };
}

function isDateOnly(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function normalizeAdminBillingPeriodFilters(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const normalized: { dateFrom?: string; dateTo?: string } = {};
  if (isDateOnly(input.dateFrom)) normalized.dateFrom = input.dateFrom!;
  if (isDateOnly(input.dateTo)) normalized.dateTo = input.dateTo!;
  return normalized;
}

function escapeCsvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildBillingInvoicesCsv(rows: Array<Record<string, any>>) {
  const headers = [
    'fatura',
    'empresa',
    'slug',
    'valor',
    'status',
    'vencimento',
    'forma_pagamento',
    'tentativas',
    'ultima_falha',
  ];

  const lines = rows.map(row => [
    row.asaas_payment_id,
    row.business?.name,
    row.business?.slug,
    row.value,
    row.status,
    row.due_date,
    row.billing_type,
    row.retry_count,
    row.last_failure_message,
  ].map(escapeCsvValue).join(','));

  return [headers.join(','), ...lines].join('\n');
}

export function classifyPlanChange(currentValue: number, targetValue: number): PlanChangeType {
  const current = roundCurrency(currentValue);
  const target = roundCurrency(targetValue);

  if (target > current) return 'upgrade';
  if (target < current) return 'downgrade';
  return 'same';
}

export function calculateImmediateUpgradeCharge(currentValue: number, targetValue: number) {
  return Math.max(0, roundCurrency(roundCurrency(targetValue) - roundCurrency(currentValue)));
}

export function assertPlanCoversUsageSnapshot(plan: PlanLimits, usage: UsageSnapshot) {
  const violations = [
    {
      label: 'colaboradores',
      current: usage.collaborators,
      max: plan.max_collaborators,
    },
    {
      label: 'servicos',
      current: usage.services,
      max: plan.max_services,
    },
    {
      label: 'agendamentos no mes',
      current: usage.appointmentsThisMonth,
      max: plan.max_appointments_month,
    },
  ].filter(item => item.max != null && item.current > Number(item.max));

  if (violations.length > 0) {
    const details = violations
      .map(item => `${item.label}: uso ${item.current}, limite ${item.max}`)
      .join('; ');
    throw new AppError(
      422,
      `Plano selecionado nao cobre o uso atual (${details}). Reduza o uso ou escolha um plano maior.`,
      'PLAN_LIMIT_EXCEEDED',
    );
  }

  return { allowed: true };
}

async function getBusinessUsageSnapshot(businessId: string): Promise<UsageSnapshot> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split('T')[0];
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().split('T')[0];

  const [
    collaborators,
    services,
    appointments,
  ] = await Promise.all([
    supabase
      .from('collaborators')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('date', monthStart)
      .lt('date', nextMonthStart),
  ]);

  if (collaborators.error) throw collaborators.error;
  if (services.error) throw services.error;
  if (appointments.error) throw appointments.error;

  return {
    collaborators: collaborators.count || 0,
    services: services.count || 0,
    appointmentsThisMonth: appointments.count || 0,
  };
}

async function assertPlanCoversCurrentBusinessUsage(businessId: string, plan: PlanLimits) {
  const usage = await getBusinessUsageSnapshot(businessId);
  return assertPlanCoversUsageSnapshot(plan, usage);
}

export async function createSubscription(businessId: string, planId: string, billingCycle: BillingCycle, billingType: AsaasBillingType = 'UNDEFINED') {
  const supabase = getSupabaseAdmin();

  const existing = await getActiveSubscription(businessId);
  if (existing) {
    if (existing.status === 'pending_payment') {
      const pendingInvoice = await getLatestPayableInvoice(existing.id);
      if (pendingInvoice) {
        return {
          subscription: existing,
          plan: existing.plan,
          ...buildPendingInvoiceCheckoutResponse(pendingInvoice),
        };
      }
    }
    throw new AppError(409, 'Ja existe uma assinatura ativa. Cancele ou faca upgrade.', 'SUBSCRIPTION_EXISTS');
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .single();

  if (planError || !plan) throw new NotFoundError('Plano nao encontrado ou inativo.');

  const { data: businessStatus, error: businessStatusError } = await supabase
    .from('businesses')
    .select('subscription_status')
    .eq('id', businessId)
    .single();

  if (businessStatusError || !businessStatus) throw new NotFoundError('Empresa nao encontrada.');

  const value = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  validateSubscriptionValue(value);
  await assertPlanCoversCurrentBusinessUsage(businessId, plan);

  const customerId = await ensurePlatformCustomer(businessId);
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

  const paymentList = await asaasRequest<{ data?: AsaasSubscriptionPayment[] }>({
    apiKey,
    environment,
    path: `/subscriptions/${sub.id}/payments?limit=1`,
  });
  const firstPayment = paymentList.data?.[0] || null;
  const paymentUrl = getAsaasPaymentUrl(firstPayment);

  const record = await insertPlatformSubscriptionRecord({
    businessId,
    planId,
    asaasSubscriptionId: sub.id,
    billingCycle,
    value,
    nextDueDate: sub.nextDueDate || dueDateStr,
  });

  let invoice = null;
  if (firstPayment?.id) {
    invoice = await upsertPlatformInvoice(buildPlatformInvoiceRecord({
      businessId,
      subscriptionId: record.id,
      payment: firstPayment,
      fallbackValue: value,
      fallbackDueDate: dueDateStr,
      requestedBillingType: billingType,
    }));
  }

  if (!['trial', 'blocked', 'overdue', 'cancelled'].includes(businessStatus.subscription_status)) {
    await supabase
      .from('businesses')
      .update({ subscription_status: 'active' })
      .eq('id', businessId);
  }

  return {
    subscription: record,
    plan,
    payment_url: paymentUrl,
    checkout_url: invoice?.id ? buildSubscriptionCheckoutUrl(invoice.id) : null,
    payment: firstPayment,
    invoice,
  };
}

export async function getActiveSubscription(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('*, plan:plans!platform_subscriptions_plan_id_fkey(id, name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month)')
    .eq('business_id', businessId)
    .in('status', CURRENT_SUBSCRIPTION_STATUSES)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upgradeSubscription(
  businessId: string,
  newPlanId: string,
  newBillingCycle?: BillingCycle,
  billingType: AsaasBillingType = 'UNDEFINED',
) {
  const current = await getActiveSubscription(businessId);
  if (!current) throw new NotFoundError('Nenhuma assinatura ativa encontrada.');
  if (current.status === 'pending_payment') {
    const pendingInvoice = await getLatestPayableInvoice(current.id);
    if (pendingInvoice) {
      throw new AppError(409, 'Existe uma assinatura aguardando pagamento. Conclua a fatura pendente antes de trocar de plano.', 'SUBSCRIPTION_PAYMENT_PENDING');
    }
    throw new AppError(409, 'Existe uma assinatura aguardando pagamento.', 'SUBSCRIPTION_PAYMENT_PENDING');
  }

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
  validateSubscriptionValue(newValue);
  await assertPlanCoversCurrentBusinessUsage(businessId, newPlan);

  const { apiKey, environment } = getPlatformAsaas();
  const changeType = classifyPlanChange(Number(current.value), Number(newValue));
  if (changeType === 'same' && current.plan_id === newPlanId && current.billing_cycle === billingCycle) {
    throw new AppError(409, 'Este plano ja esta ativo.', 'PLAN_ALREADY_ACTIVE');
  }

  if (changeType === 'upgrade') {
    const samePendingInvoice = await getLatestPayableInvoice(current.id, {
      purpose: 'plan_change',
      pendingPlanId: newPlanId,
      pendingBillingCycle: billingCycle,
    });
    if (samePendingInvoice) {
      return {
        success: true,
        change_type: changeType,
        effective_at: current.pending_effective_at || new Date().toISOString().split('T')[0],
        plan: newPlan,
        value: newValue,
        billing_cycle: billingCycle,
        ...buildPendingInvoiceCheckoutResponse(samePendingInvoice),
      };
    }

    if (current.pending_change_type === 'upgrade' && current.pending_plan_id) {
      throw new AppError(
        409,
        'Ja existe um upgrade pendente de pagamento. Pague ou cancele a fatura pendente antes de escolher outro plano.',
        'PENDING_PLAN_CHANGE_EXISTS',
      );
    }
  }

  const effectiveDate = changeType === 'downgrade'
    ? (current.next_due_date || new Date().toISOString().split('T')[0])
    : new Date().toISOString().split('T')[0];

  await supabase
    .from('platform_subscriptions')
    .update({
      pending_plan_id: newPlanId,
      pending_billing_cycle: billingCycle,
      pending_value: newValue,
      pending_change_type: changeType,
      pending_effective_at: effectiveDate,
    })
    .eq('id', current.id);

  if (changeType === 'downgrade') {
    await updateAsaasRecurringSubscription(current.asaas_subscription_id, newPlan, billingCycle, newValue);
    return {
      success: true,
      pending: true,
      change_type: changeType,
      effective_at: effectiveDate,
      plan: newPlan,
      value: newValue,
      billing_cycle: billingCycle,
      payment_url: null,
    };
  }

  const customerId = await ensurePlatformCustomer(businessId);
  const chargeValue = calculateImmediateUpgradeCharge(Number(current.value), Number(newValue));
  validateSubscriptionValue(chargeValue);
  const dueDate = new Date().toISOString().split('T')[0];
  const payment = await asaasRequest<AsaasSubscriptionPayment>({
    apiKey,
    environment,
    path: '/payments',
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value: chargeValue,
      dueDate,
      description: `Sistematize - Upgrade para Plano ${newPlan.name}`,
      externalReference: `plan-change:${current.id}:${newPlanId}`,
    },
  });

  let invoice = null;
  if (payment?.id) {
    invoice = await upsertPlatformInvoice({
      ...buildPlatformInvoiceRecord({
        businessId,
        subscriptionId: current.id,
        payment,
        fallbackValue: chargeValue,
        fallbackDueDate: dueDate,
        requestedBillingType: billingType,
      }),
      purpose: 'plan_change',
      pending_plan_id: newPlanId,
      pending_billing_cycle: billingCycle,
    });
  }

  return {
    success: true,
    pending: true,
    change_type: changeType,
    effective_at: effectiveDate,
    plan: newPlan,
    value: newValue,
    billing_cycle: billingCycle,
    payment_url: getAsaasPaymentUrl(payment),
    checkout_url: invoice?.id ? buildSubscriptionCheckoutUrl(invoice.id) : null,
    payment,
    invoice,
  };
}

async function updateAsaasRecurringSubscription(
  asaasSubscriptionId: string,
  plan: { name: string },
  billingCycle: BillingCycle,
  value: number,
) {
  const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const { apiKey, environment } = getPlatformAsaas();

  await asaasRequest({
    apiKey,
    environment,
    path: `/subscriptions/${asaasSubscriptionId}`,
    method: 'PUT',
    body: {
      value,
      cycle,
      description: `Sistematize - Plano ${plan.name} (${billingCycle === 'yearly' ? 'anual' : 'mensal'})`,
    },
  });
}

export async function applyPendingPlanChange(subscriptionId: string) {
  const supabase = getSupabaseAdmin();
  const { data: subscription, error } = await supabase
    .from('platform_subscriptions')
    .select('id, business_id, asaas_subscription_id, pending_plan_id, pending_billing_cycle, pending_value, pending_change_type, pending_plan:plans!platform_subscriptions_pending_plan_id_fkey(id, name)')
    .eq('id', subscriptionId)
    .single();

  if (error) throw error;
  if (!subscription?.pending_plan_id || !subscription.pending_billing_cycle || !subscription.pending_value) {
    return { applied: false, reason: 'no_pending_change' };
  }

  const pendingPlan = Array.isArray(subscription.pending_plan)
    ? subscription.pending_plan[0]
    : subscription.pending_plan;

  if (!pendingPlan) throw new NotFoundError('Plano pendente nao encontrado.');

  await updateAsaasRecurringSubscription(
    subscription.asaas_subscription_id,
    pendingPlan,
    subscription.pending_billing_cycle,
    Number(subscription.pending_value),
  );

  await supabase
    .from('platform_subscriptions')
    .update({
      plan_id: subscription.pending_plan_id,
      billing_cycle: subscription.pending_billing_cycle,
      value: subscription.pending_value,
      pending_plan_id: null,
      pending_billing_cycle: null,
      pending_value: null,
      pending_change_type: null,
      pending_effective_at: null,
      status: 'active',
    })
    .eq('id', subscription.id);

  await supabase
    .from('businesses')
    .update({ plan_id: subscription.pending_plan_id, subscription_status: 'paid' })
    .eq('id', subscription.business_id);

  return { applied: true, change_type: subscription.pending_change_type };
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

async function getOwnedInvoice(businessId: string, invoiceId: string) {
  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from('platform_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .single();

  if (error || !invoice) throw new NotFoundError('Fatura nao encontrada.');
  return invoice;
}

async function maybeRefreshInvoicePix(invoice: any) {
  const canUsePix = ['PIX', 'BOLETO', 'UNDEFINED', null].includes(invoice.billing_type);
  const shouldRefresh = ['pending', 'overdue', 'PENDING', 'OVERDUE'].includes(invoice.status);
  if (!canUsePix || !shouldRefresh || !invoice.asaas_payment_id) return invoice;

  const { apiKey, environment } = getPlatformAsaas();
  try {
    const pix = await asaasRequest<AsaasPixQrCode>({
      apiKey,
      environment,
      path: `/payments/${invoice.asaas_payment_id}/pixQrCode`,
    });

    if (!pix?.encodedImage && !pix?.payload) return invoice;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('platform_invoices')
      .update({
        pix_qr_code: pix.encodedImage || invoice.pix_qr_code || null,
        pix_payload: pix.payload || invoice.pix_payload || null,
      })
      .eq('id', invoice.id)
      .select('*')
      .single();

    if (error) throw error;
    return data || invoice;
  } catch {
    return invoice;
  }
}

export async function getCheckoutInvoice(businessId: string, invoiceId: string) {
  const supabase = getSupabaseAdmin();
  const invoice = await maybeRefreshInvoicePix(await getOwnedInvoice(businessId, invoiceId));
  const paymentMethods = await listPaymentMethods(businessId);

  let subscription = null;
  if (invoice.subscription_id) {
    const { data, error } = await supabase
      .from('platform_subscriptions')
      .select('*, plan:plans!platform_subscriptions_plan_id_fkey(id, name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month), pending_plan:plans!platform_subscriptions_pending_plan_id_fkey(id, name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month)')
      .eq('id', invoice.subscription_id)
      .maybeSingle();

    if (error) throw error;
    subscription = data || null;
  }

  return {
    invoice,
    subscription,
    checkout_url: buildSubscriptionCheckoutUrl(invoice.id),
    payment_methods: paymentMethods.data,
    default_payment_method: paymentMethods.data.find(method => method.is_default) || null,
    asaas_fallback_url: getAsaasPaymentUrl({
      invoiceUrl: invoice.invoice_url,
      bankSlipUrl: invoice.bank_slip_url,
    }),
  };
}

async function applyImmediatePaidCheckoutEffects(businessId: string, invoice: any) {
  if (!invoice.subscription_id) return { action: 'none' as const };

  const supabase = getSupabaseAdmin();
  const { data: subscription, error } = await supabase
    .from('platform_subscriptions')
    .select('id, business_id, plan_id')
    .eq('id', invoice.subscription_id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw error;
  const effect = buildImmediatePaidCheckoutEffects({ invoice, subscription });

  if (effect.action === 'apply_pending_plan_change') {
    await applyPendingPlanChange(effect.subscription_id);
    return effect;
  }

  if (effect.action === 'activate_subscription') {
    await supabase
      .from('platform_subscriptions')
      .update({ status: 'active' })
      .eq('id', effect.subscription_id);

    await supabase
      .from('businesses')
      .update({ subscription_status: 'paid', plan_id: effect.plan_id })
      .eq('id', effect.business_id);
  }

  return effect;
}

export async function payCheckoutInvoiceWithCard(
  businessId: string,
  invoiceId: string,
  input: CheckoutCardPaymentInput,
  remoteIp: string,
) {
  const invoice = await getOwnedInvoice(businessId, invoiceId);
  if (!['pending', 'overdue', 'PENDING', 'OVERDUE'].includes(invoice.status)) {
    throw new AppError(409, 'Esta fatura nao esta pendente de pagamento.', 'INVOICE_NOT_PAYABLE');
  }

  const normalizedInput = normalizeCheckoutCardPaymentInput(input);
  const customerId = await ensurePlatformCustomer(businessId);
  const { apiKey, environment } = getPlatformAsaas();
  const tokenization = await asaasRequest<AsaasTokenizedCreditCard>({
    apiKey,
    environment,
    path: '/creditCard/tokenizeCreditCard',
    method: 'POST',
    body: {
      customer: customerId,
      creditCard: normalizedInput.creditCard,
      creditCardHolderInfo: normalizedInput.holderInfo,
      remoteIp,
    },
  });

  const storedMethod = buildStoredPaymentMethodRecord({
    businessId,
    customerId,
    tokenization,
    holderName: normalizedInput.creditCard.holderName,
    rawCardNumber: normalizedInput.creditCard.number,
  });

  const supabase = getSupabaseAdmin();
  let paymentMethod: {
    id: string;
    card_brand: string | null;
    card_last4: string | null;
    holder_name: string | null;
    is_default: boolean;
    status?: string | null;
    created_at: string;
    updated_at?: string | null;
    last_used_at?: string | null;
  } | null = null;

  try {
    await supabase
      .from('platform_payment_methods')
      .update({ is_default: false })
      .eq('business_id', businessId)
      .eq('is_default', true);

    const { data, error } = await supabase
      .from('platform_payment_methods')
      .insert(storedMethod)
      .select('id, card_brand, card_last4, holder_name, is_default, status, created_at, updated_at, last_used_at')
      .single();

    if (error) throw error;
    paymentMethod = data;
  } catch {
    paymentMethod = null;
  }

  const subscriptionForCard = await getSubscriptionForInvoice(invoice);
  try {
    await attachCreditCardTokenToAsaasSubscription(
      subscriptionForCard?.asaas_subscription_id,
      storedMethod.asaas_credit_card_token,
      remoteIp,
    );
    await recordBillingEvent({
      businessId,
      subscriptionId: invoice.subscription_id,
      invoiceId: invoice.id,
      paymentMethodId: paymentMethod?.id || null,
      eventType: 'subscription_card_attached',
      message: 'Cartao padrao vinculado a assinatura recorrente no Asaas.',
      metadata: { card_brand: paymentMethod?.card_brand, card_last4: paymentMethod?.card_last4 },
    });
  } catch (err) {
    await recordBillingEvent({
      businessId,
      subscriptionId: invoice.subscription_id,
      invoiceId: invoice.id,
      paymentMethodId: paymentMethod?.id || null,
      eventType: 'subscription_card_attach_failed',
      severity: 'warn',
      message: err instanceof Error ? err.message : 'Falha ao vincular cartao recorrente no Asaas.',
    });
  }

  const payment = await asaasRequest<AsaasSubscriptionPayment>({
    apiKey,
    environment,
    path: `/payments/${invoice.asaas_payment_id}/payWithCreditCard`,
    method: 'POST',
    body: {
      creditCardToken: storedMethod.asaas_credit_card_token,
    },
  });

  const { data: updatedInvoice, error: invoiceUpdateError } = await supabase
    .from('platform_invoices')
    .update({
      billing_type: payment.billingType || 'CREDIT_CARD',
      status: normalizePlatformInvoiceStatus(payment.status || invoice.status),
      net_value: payment.netValue ?? invoice.net_value,
      invoice_url: payment.invoiceUrl || invoice.invoice_url,
      bank_slip_url: payment.bankSlipUrl || invoice.bank_slip_url,
    })
    .eq('id', invoice.id)
    .select('*')
    .single();

  if (invoiceUpdateError) throw invoiceUpdateError;
  const paid = ['CONFIRMED', 'RECEIVED', 'confirmed', 'received'].includes(payment.status || '');
  if (paymentMethod?.id) {
    await supabase
      .from('platform_payment_methods')
      .update({
        last_used_at: new Date().toISOString(),
        failed_attempts: paid ? 0 : undefined,
      })
      .eq('id', paymentMethod.id);
  }
  await recordBillingEvent({
    businessId,
    subscriptionId: updatedInvoice.subscription_id,
    invoiceId: updatedInvoice.id,
    paymentMethodId: paymentMethod?.id || null,
    eventType: paid ? 'card_payment_confirmed' : 'card_payment_submitted',
    severity: paid ? 'info' : 'warn',
    message: paid ? 'Pagamento por cartao confirmado.' : 'Pagamento por cartao enviado para confirmacao.',
    metadata: { asaas_payment_status: payment.status, billing_type: payment.billingType },
  });
  const effect = paid
    ? await applyImmediatePaidCheckoutEffects(businessId, updatedInvoice)
    : { action: 'waiting_confirmation' as const };

  return {
    success: true,
    invoice: updatedInvoice,
    payment_method: paymentMethod ? sanitizePaymentMethodForClient(paymentMethod) : null,
    paid,
    effect,
  };
}

export async function listPaymentMethods(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('platform_payment_methods')
    .select('id, holder_name, card_brand, card_last4, is_default, status, created_at, updated_at, last_used_at')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .is('disabled_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { data: (data || []).map(sanitizePaymentMethodForClient) };
}

export async function setDefaultPaymentMethod(businessId: string, paymentMethodId: string, remoteIp?: string) {
  const supabase = getSupabaseAdmin();
  const { data: method, error } = await supabase
    .from('platform_payment_methods')
    .select('*')
    .eq('id', paymentMethodId)
    .eq('business_id', businessId)
    .eq('status', 'active')
    .is('disabled_at', null)
    .single();

  if (error || !method) throw new NotFoundError('Forma de pagamento nao encontrada.');

  await supabase
    .from('platform_payment_methods')
    .update({ is_default: false })
    .eq('business_id', businessId)
    .eq('is_default', true);

  const { data: updated, error: updateError } = await supabase
    .from('platform_payment_methods')
    .update({ is_default: true })
    .eq('id', paymentMethodId)
    .select('id, holder_name, card_brand, card_last4, is_default, status, created_at, updated_at, last_used_at')
    .single();

  if (updateError) throw updateError;

  const current = await getActiveSubscription(businessId);
  if (current?.asaas_subscription_id) {
    try {
      await attachCreditCardTokenToAsaasSubscription(current.asaas_subscription_id, method.asaas_credit_card_token, remoteIp);
      await recordBillingEvent({
        businessId,
        subscriptionId: current.id,
        paymentMethodId,
        eventType: 'default_payment_method_attached',
        message: 'Forma de pagamento padrao atualizada na assinatura recorrente.',
      });
    } catch (err) {
      await recordBillingEvent({
        businessId,
        subscriptionId: current.id,
        paymentMethodId,
        eventType: 'default_payment_method_attach_failed',
        severity: 'warn',
        message: err instanceof Error ? err.message : 'Falha ao atualizar cartao padrao no Asaas.',
      });
    }
  }

  return sanitizePaymentMethodForClient(updated);
}

export async function disablePaymentMethod(businessId: string, paymentMethodId: string) {
  const supabase = getSupabaseAdmin();
  const defaultMethod = await getDefaultPaymentMethod(businessId);
  if (defaultMethod?.id === paymentMethodId) {
    const { data: openInvoices, error: invoiceError } = await supabase
      .from('platform_invoices')
      .select('id')
      .eq('business_id', businessId)
      .in('status', PAYABLE_INVOICE_STATUSES)
      .limit(1);

    if (invoiceError) throw invoiceError;
    if ((openInvoices || []).length > 0) {
      throw new AppError(409, 'Nao e possivel remover o cartao padrao com fatura pendente.', 'DEFAULT_CARD_HAS_OPEN_INVOICE');
    }
  }

  const { data, error } = await supabase
    .from('platform_payment_methods')
    .update({ status: 'disabled', disabled_at: new Date().toISOString(), is_default: false })
    .eq('id', paymentMethodId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError('Forma de pagamento nao encontrada.');

  await recordBillingEvent({
    businessId,
    paymentMethodId,
    eventType: 'payment_method_disabled',
    message: 'Forma de pagamento removida pelo usuario.',
  });
  return { success: true };
}

async function payInvoiceWithStoredPaymentMethod(
  businessId: string,
  invoice: any,
  paymentMethod: any,
  options?: { automatic?: boolean },
) {
  const { apiKey, environment } = getPlatformAsaas();
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    const payment = await asaasRequest<AsaasSubscriptionPayment>({
      apiKey,
      environment,
      path: `/payments/${invoice.asaas_payment_id}/payWithCreditCard`,
      method: 'POST',
      body: {
        creditCardToken: paymentMethod.asaas_credit_card_token,
      },
    });

    const paid = ['CONFIRMED', 'RECEIVED', 'confirmed', 'received'].includes(payment.status || '');
    const { data: updatedInvoice, error: invoiceError } = await supabase
      .from('platform_invoices')
      .update({
        billing_type: payment.billingType || 'CREDIT_CARD',
        status: normalizePlatformInvoiceStatus(payment.status || invoice.status),
        net_value: payment.netValue ?? invoice.net_value,
        invoice_url: payment.invoiceUrl || invoice.invoice_url,
        bank_slip_url: payment.bankSlipUrl || invoice.bank_slip_url,
        payment_method_id: paymentMethod.id,
        last_retry_at: now,
        last_failure_message: paid ? null : invoice.last_failure_message || null,
      })
      .eq('id', invoice.id)
      .select('*')
      .single();

    if (invoiceError) throw invoiceError;

    await supabase
      .from('platform_payment_methods')
      .update({ last_used_at: now, failed_attempts: paid ? 0 : Number(paymentMethod.failed_attempts || 0) })
      .eq('id', paymentMethod.id);

    if (paid) await applyImmediatePaidCheckoutEffects(businessId, updatedInvoice);

    await recordBillingEvent({
      businessId,
      subscriptionId: updatedInvoice.subscription_id,
      invoiceId: updatedInvoice.id,
      paymentMethodId: paymentMethod.id,
      eventType: paid ? 'saved_card_payment_confirmed' : 'saved_card_payment_submitted',
      message: options?.automatic ? 'Retentativa automatica com cartao salvo.' : 'Pagamento com cartao salvo enviado.',
      metadata: { automatic: Boolean(options?.automatic), asaas_payment_status: payment.status },
    });

    return {
      success: true,
      paid,
      invoice: updatedInvoice,
      payment_method: sanitizePaymentMethodForClient(paymentMethod),
    };
  } catch (err) {
    const schedule = calculateBillingRetrySchedule(Number(invoice.retry_count || 0), now);
    const message = err instanceof Error ? err.message : 'Falha ao cobrar cartao salvo.';

    await supabase
      .from('platform_invoices')
      .update({
        retry_count: schedule.retry_count,
        next_retry_at: schedule.next_retry_at,
        last_retry_at: now,
        last_failure_message: message,
        payment_method_id: paymentMethod.id,
        status: schedule.exhausted ? 'overdue' : invoice.status,
      })
      .eq('id', invoice.id);

    await supabase
      .from('platform_payment_methods')
      .update({
        failed_attempts: Number(paymentMethod.failed_attempts || 0) + 1,
        last_failure_message: message,
      })
      .eq('id', paymentMethod.id);

    await recordBillingEvent({
      businessId,
      subscriptionId: invoice.subscription_id,
      invoiceId: invoice.id,
      paymentMethodId: paymentMethod.id,
      eventType: 'saved_card_payment_failed',
      severity: schedule.exhausted ? 'error' : 'warn',
      message,
      metadata: { automatic: Boolean(options?.automatic), exhausted: schedule.exhausted },
    });

    if (options?.automatic) {
      return { success: false, paid: false, error: message, retry: schedule };
    }
    throw err;
  }
}

export async function payCheckoutInvoiceWithSavedCard(businessId: string, invoiceId: string) {
  const invoice = await getOwnedInvoice(businessId, invoiceId);
  if (!['pending', 'overdue', 'PENDING', 'OVERDUE'].includes(invoice.status)) {
    throw new AppError(409, 'Esta fatura nao esta pendente de pagamento.', 'INVOICE_NOT_PAYABLE');
  }

  const method = await getDefaultPaymentMethod(businessId);
  if (!method) throw new NotFoundError('Nenhum cartao padrao ativo encontrado.');

  return payInvoiceWithStoredPaymentMethod(businessId, invoice, method);
}

export async function retryDuePlatformCardPayments(now = new Date().toISOString(), limit = 50) {
  const supabase = getSupabaseAdmin();
  const { data: invoices, error } = await supabase
    .from('platform_invoices')
    .select('*')
    .in('status', PAYABLE_INVOICE_STATUSES)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .lt('retry_count', BILLING_RETRY_DELAYS_DAYS.length)
    .order('due_date', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw error;

  const results: Array<Record<string, any>> = [];
  for (const invoice of invoices || []) {
    const method = await getDefaultPaymentMethod(invoice.business_id);
    if (!method) {
      results.push({ invoice_id: invoice.id, skipped: true, reason: 'no_default_payment_method' });
      continue;
    }
    const result = await payInvoiceWithStoredPaymentMethod(invoice.business_id, invoice, method, { automatic: true });
    results.push({ invoice_id: invoice.id, ...result });
  }

  return { processed: results.length, results };
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
    .select('*, plan:plans!platform_subscriptions_plan_id_fkey(id, name, price_monthly, price_yearly), business:businesses(id, name, slug, subscription_status)', { count: 'exact' })
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

export async function adminListBillingInvoices(filters: {
  status?: string;
  businessId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  const page = Math.max(filters.page || 1, 1);
  const limit = Math.min(Math.max(filters.limit || 25, 1), 100);
  const offset = (page - 1) * limit;
  const period = normalizeAdminBillingPeriodFilters({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  let query = supabase
    .from('platform_invoices')
    .select(`
      id,
      business_id,
      subscription_id,
      asaas_payment_id,
      value,
      net_value,
      billing_type,
      status,
      due_date,
      paid_at,
      invoice_url,
      bank_slip_url,
      purpose,
      pending_plan_id,
      pending_billing_cycle,
      retry_count,
      next_retry_at,
      last_retry_at,
      last_failure_message,
      payment_method_id,
      created_at,
      updated_at,
      business:businesses(id, name, slug, subscription_status),
      subscription:platform_subscriptions(id, status, billing_cycle, value, next_due_date),
      payment_method:platform_payment_methods(id, holder_name, card_brand, card_last4, is_default, status, failed_attempts, last_failure_message, last_used_at)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.businessId) query = query.eq('business_id', filters.businessId);
  if (period.dateFrom) query = query.gte('due_date', period.dateFrom);
  if (period.dateTo) query = query.lte('due_date', period.dateTo);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

export async function adminExportBillingInvoicesCsv(filters: {
  status?: string;
  businessId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const supabase = getSupabaseAdmin();
  const period = normalizeAdminBillingPeriodFilters({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  let query = supabase
    .from('platform_invoices')
    .select(`
      asaas_payment_id,
      value,
      billing_type,
      status,
      due_date,
      retry_count,
      last_failure_message,
      business:businesses(name, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.businessId) query = query.eq('business_id', filters.businessId);
  if (period.dateFrom) query = query.gte('due_date', period.dateFrom);
  if (period.dateTo) query = query.lte('due_date', period.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return buildBillingInvoicesCsv(data || []);
}

export async function adminListBillingEvents(filters: {
  severity?: string;
  businessId?: string;
  invoiceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  const page = Math.max(filters.page || 1, 1);
  const limit = Math.min(Math.max(filters.limit || 30, 1), 100);
  const offset = (page - 1) * limit;
  const period = normalizeAdminBillingPeriodFilters({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  let query = supabase
    .from('platform_billing_events')
    .select(`
      id,
      business_id,
      subscription_id,
      invoice_id,
      payment_method_id,
      event_type,
      severity,
      message,
      metadata,
      created_at,
      business:businesses(id, name, slug),
      invoice:platform_invoices(id, status, value, due_date, asaas_payment_id),
      payment_method:platform_payment_methods(id, holder_name, card_brand, card_last4)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.businessId) query = query.eq('business_id', filters.businessId);
  if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId);
  if (period.dateFrom) query = query.gte('created_at', `${period.dateFrom}T00:00:00.000Z`);
  if (period.dateTo) query = query.lte('created_at', `${period.dateTo}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

export async function adminGetBillingOperations() {
  const supabase = getSupabaseAdmin();

  const [invoiceResult, eventResult, methodResult] = await Promise.all([
    supabase
      .from('platform_invoices')
      .select('id, status, value, retry_count, next_retry_at, due_date, last_failure_message, business_id')
      .in('status', RETRYABLE_INVOICE_STATUSES)
      .order('due_date', { ascending: true })
      .limit(1000),
    supabase
      .from('platform_billing_events')
      .select('id, severity, event_type, message, created_at')
      .in('severity', ['warn', 'error'])
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('platform_payment_methods')
      .select('id, business_id, card_brand, card_last4, failed_attempts, last_failure_message')
      .gt('failed_attempts', 0)
      .eq('status', 'active')
      .limit(250),
  ]);

  if (invoiceResult.error) throw invoiceResult.error;
  if (eventResult.error) throw eventResult.error;
  if (methodResult.error) throw methodResult.error;

  return {
    summary: buildAdminBillingOperationsSummary({
      invoices: invoiceResult.data || [],
      events: eventResult.data || [],
      paymentMethods: methodResult.data || [],
    }),
    retryable_invoices: invoiceResult.data || [],
    recent_warnings: eventResult.data || [],
    failing_payment_methods: methodResult.data || [],
  };
}

export async function adminRetryInvoiceWithDefaultCard(invoiceId: string) {
  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from('platform_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) throw new NotFoundError('Fatura nao encontrada.');
  if (!isRetryablePlatformInvoiceStatus(invoice.status)) {
    throw new AppError(409, 'Esta fatura nao pode ser reprocessada.', 'INVOICE_NOT_RETRYABLE');
  }

  const method = await getDefaultPaymentMethod(invoice.business_id);
  if (!method) throw new NotFoundError('Nenhum cartao padrao ativo encontrado para esta empresa.');

  return payInvoiceWithStoredPaymentMethod(invoice.business_id, invoice, method, { automatic: false });
}
