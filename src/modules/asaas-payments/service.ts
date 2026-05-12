import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../../config/supabase.js';
import { decrypt } from '../../utils/crypto.js';
import { asaasRequest } from '../../utils/asaas-client.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { getConnection } from '../integrations/service.js';

type AsaasEnv = 'sandbox' | 'production';

export async function ensureAsaasCustomer(businessId: string, clientId: string) {
  const supabase = getSupabaseAdmin();

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, email, phone, asaas_customer_id')
    .eq('id', clientId)
    .eq('business_id', businessId)
    .single();

  if (error || !client) throw new NotFoundError('Cliente nao encontrado.');

  if (client.asaas_customer_id) {
    return client.asaas_customer_id;
  }

  const connection = await getConnection(businessId);
  const apiKey = decrypt(connection.api_key_encrypted);

  const asaasCustomer = await asaasRequest<{ id: string }>({
    apiKey,
    environment: connection.environment as AsaasEnv,
    path: '/customers',
    method: 'POST',
    body: {
      name: client.name,
      email: client.email || undefined,
      phone: client.phone || undefined,
    },
  });

  await supabase
    .from('clients')
    .update({ asaas_customer_id: asaasCustomer.id })
    .eq('id', clientId);

  return asaasCustomer.id;
}

export async function createPayment(businessId: string, input: {
  clientId: string;
  appointmentId?: string;
  value: number;
  dueDate: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  description?: string;
}) {
  const asaasCustomerId = await ensureAsaasCustomer(businessId, input.clientId);
  const connection = await getConnection(businessId);
  const apiKey = decrypt(connection.api_key_encrypted);

  const externalReference = `biz_${businessId}_apt_${input.appointmentId || randomUUID()}`;

  const payment = await asaasRequest<{
    id: string;
    status: string;
    invoiceUrl: string;
    bankSlipUrl?: string;
    pixQrCode?: { payload: string; encodedImage: string };
    value: number;
    netValue: number;
  }>({
    apiKey,
    environment: connection.environment as AsaasEnv,
    path: '/payments',
    method: 'POST',
    body: {
      customer: asaasCustomerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description || 'Pagamento via Sistematize',
      externalReference,
    },
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_payments')
    .insert({
      business_id: businessId,
      appointment_id: input.appointmentId || null,
      client_id: input.clientId,
      asaas_payment_id: payment.id,
      asaas_customer_id: asaasCustomerId,
      billing_type: input.billingType,
      value: input.value,
      net_value: payment.netValue || null,
      due_date: input.dueDate,
      status: payment.status,
      invoice_url: payment.invoiceUrl || null,
      bank_slip_url: payment.bankSlipUrl || null,
      pix_qr_code: payment.pixQrCode?.encodedImage || null,
      pix_payload: payment.pixQrCode?.payload || null,
      external_reference: externalReference,
      raw_response: payment,
    })
    .select('*')
    .single();

  if (error) throw error;

  if (input.appointmentId) {
    await supabase
      .from('appointments')
      .update({ payment_status: 'waiting' })
      .eq('id', input.appointmentId)
      .eq('business_id', businessId);
  }

  return data;
}

export async function listPayments(businessId: string, filters: {
  status?: string;
  billing_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('asaas_payments')
    .select('*, client:clients(id, name, phone, email), appointment:appointments(id, date, start_time, status)', { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.billing_type) query = query.eq('billing_type', filters.billing_type);
  if (filters.date_from) query = query.gte('due_date', filters.date_from);
  if (filters.date_to) query = query.lte('due_date', filters.date_to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count || 0, page, limit };
}

export async function getPayment(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_payments')
    .select('*, client:clients(id, name, phone, email), appointment:appointments(id, date, start_time, status)')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Pagamento nao encontrado.');
    throw error;
  }
  return data;
}

export async function cancelPayment(id: string, businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data: localPayment, error } = await supabase
    .from('asaas_payments')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();

  if (error || !localPayment) throw new NotFoundError('Pagamento nao encontrado.');
  if (['RECEIVED', 'CONFIRMED', 'REFUNDED', 'DELETED'].includes(localPayment.status)) {
    throw new AppError(422, 'Este pagamento nao pode ser cancelado.', 'PAYMENT_NOT_CANCELLABLE');
  }

  const connection = await getConnection(businessId);
  const apiKey = decrypt(connection.api_key_encrypted);

  await asaasRequest({
    apiKey,
    environment: connection.environment as AsaasEnv,
    path: `/payments/${localPayment.asaas_payment_id}`,
    method: 'DELETE',
  });

  await supabase
    .from('asaas_payments')
    .update({ status: 'CANCELLED' })
    .eq('id', id);

  if (localPayment.appointment_id) {
    await supabase
      .from('appointments')
      .update({ payment_status: 'cancelled' })
      .eq('id', localPayment.appointment_id);
  }

  return { success: true };
}

export async function getPaymentsSummary(businessId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { data: received } = await supabase
    .from('asaas_payments')
    .select('value')
    .eq('business_id', businessId)
    .in('status', ['RECEIVED', 'CONFIRMED'])
    .gte('created_at', firstDayOfMonth);

  const { data: pending } = await supabase
    .from('asaas_payments')
    .select('value')
    .eq('business_id', businessId)
    .eq('status', 'PENDING');

  const { data: overdue } = await supabase
    .from('asaas_payments')
    .select('value')
    .eq('business_id', businessId)
    .eq('status', 'OVERDUE');

  const sum = (rows: { value: number }[] | null) =>
    (rows || []).reduce((acc, r) => acc + Number(r.value), 0);

  return {
    received_month: sum(received),
    pending_total: sum(pending),
    overdue_total: sum(overdue),
    pending_count: pending?.length || 0,
    overdue_count: overdue?.length || 0,
  };
}
