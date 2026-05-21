import { getSupabaseAdmin } from '../../config/supabase.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { assertBusinessCanUseModule } from '../modules/access-control.js';

export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash' | 'external';
export type FinancialStatus = 'received' | 'pending' | 'cancelled';
export type FinancialSource = 'manual' | 'asaas' | 'appointment';

export type CreateManualIncomeInput = {
  amount: number;
  payment_method: PaymentMethod;
  occurred_on: string;
  status?: 'received' | 'pending';
  appointment_id?: string;
  client_id?: string;
  collaborator_id?: string;
  service_id?: string;
  description?: string;
};

export type FinancialRecordFilters = {
  date_from?: string;
  date_to?: string;
  payment_method?: string;
  status?: string;
  source?: string;
  collaborator_id?: string;
  service_id?: string;
  client_id?: string;
  page?: number;
  limit?: number;
};

type CsvRecord = {
  occurred_on: string;
  type: string;
  source: string;
  status: string;
  payment_method: string;
  amount: number;
  commission_amount?: number | null;
  description?: string | null;
  client?: { name?: string | null } | null;
  collaborator?: { name?: string | null } | null;
  service?: { name?: string | null } | null;
};

export function calculateCommissionAmount(amount: number, commissionPercent?: number | null): number {
  const value = amount * (Number(commissionPercent || 0) / 100);
  return Math.round(value * 100) / 100;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function financialRecordsToCsv(records: CsvRecord[]): string {
  const header = ['Data', 'Tipo', 'Origem', 'Status', 'Forma', 'Cliente', 'Profissional', 'Servico', 'Descricao', 'Valor', 'Comissao'];
  const rows = records.map((record) => [
    record.occurred_on,
    record.type,
    record.source,
    record.status,
    record.payment_method,
    record.client?.name || '',
    record.collaborator?.name || '',
    record.service?.name || '',
    record.description || '',
    Number(record.amount || 0).toFixed(2),
    Number(record.commission_amount || 0).toFixed(2),
  ].map(csvCell).join(','));

  return [header.join(','), ...rows].join('\n');
}

export function mapAsaasStatusToFinancialStatus(status: string): FinancialStatus {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) return 'received';
  if (['REFUNDED', 'CANCELLED', 'DELETED'].includes(status)) return 'cancelled';
  return 'pending';
}

export async function upsertAsaasFinancialRecord(input: {
  business_id: string;
  asaas_payment_row_id: string;
  appointment_id?: string | null;
  client_id?: string | null;
  value: number;
  status: string;
  due_date: string;
}) {
  const supabase = getSupabaseAdmin();
  const resolved = await resolveAppointmentFinancialLinks(input.business_id, input.appointment_id, input.client_id);
  const commissionPercent = await resolveCommissionPercent(input.business_id, resolved.collaborator_id, resolved.service_id);
  const commissionAmount = calculateCommissionAmount(input.value, commissionPercent);

  const { data, error } = await supabase
    .from('financial_records')
    .upsert({
      business_id: input.business_id,
      asaas_payment_id: input.asaas_payment_row_id,
      appointment_id: input.appointment_id || null,
      client_id: resolved.client_id || null,
      collaborator_id: resolved.collaborator_id || null,
      service_id: resolved.service_id || null,
      type: 'income',
      source: 'asaas',
      status: mapAsaasStatusToFinancialStatus(input.status),
      payment_method: 'asaas',
      amount: input.value,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      occurred_on: input.due_date,
      description: 'Cobranca Asaas',
    }, { onConflict: 'asaas_payment_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createManualIncome(
  businessId: string,
  input: CreateManualIncomeInput,
  profileId?: string,
) {
  await assertBusinessCanUseModule(businessId, 'financial', profileId);
  if (input.amount <= 0) throw new ValidationError('Valor deve ser maior que zero.');

  const supabase = getSupabaseAdmin();
  const resolved = await resolveIncomeLinks(businessId, input);
  const commissionPercent = await resolveCommissionPercent(businessId, resolved.collaborator_id, resolved.service_id);
  const commissionAmount = calculateCommissionAmount(input.amount, commissionPercent);

  const { data, error } = await supabase
    .from('financial_records')
    .insert({
      business_id: businessId,
      type: 'income',
      source: 'manual',
      status: input.status || 'received',
      payment_method: input.payment_method,
      amount: input.amount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      occurred_on: input.occurred_on,
      appointment_id: resolved.appointment_id || null,
      client_id: resolved.client_id || null,
      collaborator_id: resolved.collaborator_id || null,
      service_id: resolved.service_id || null,
      description: input.description || null,
      created_by: profileId || null,
    })
    .select('*, client:clients(id, name), collaborator:collaborators(id, name), service:services(id, name), appointment:appointments(id, date, start_time, status)')
    .single();

  if (error) throw error;

  if (resolved.appointment_id && (input.status || 'received') === 'received') {
    await supabase
      .from('appointments')
      .update({ payment_status: 'received', payment_method: input.payment_method })
      .eq('id', resolved.appointment_id)
      .eq('business_id', businessId);
  }

  return data;
}

async function resolveIncomeLinks(businessId: string, input: CreateManualIncomeInput) {
  const supabase = getSupabaseAdmin();
  const resolved = {
    appointment_id: input.appointment_id,
    client_id: input.client_id,
    collaborator_id: input.collaborator_id,
    service_id: input.service_id,
  };

  if (!input.appointment_id) return resolved;

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('id, client_id, collaborator_id, appointment_services(service_id)')
    .eq('id', input.appointment_id)
    .eq('business_id', businessId)
    .single();

  if (error || !appointment) throw new NotFoundError('Agendamento nao encontrado.');

  const appointmentServices = (appointment as any).appointment_services || [];
  return {
    appointment_id: appointment.id,
    client_id: input.client_id || appointment.client_id,
    collaborator_id: input.collaborator_id || appointment.collaborator_id,
    service_id: input.service_id || appointmentServices[0]?.service_id,
  };
}

async function resolveAppointmentFinancialLinks(
  businessId: string,
  appointmentId?: string | null,
  clientId?: string | null,
) {
  if (!appointmentId) {
    return {
      client_id: clientId || undefined,
      collaborator_id: undefined,
      service_id: undefined,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, client_id, collaborator_id, appointment_services(service_id)')
    .eq('id', appointmentId)
    .eq('business_id', businessId)
    .maybeSingle();

  const appointmentServices = (appointment as any)?.appointment_services || [];
  return {
    client_id: clientId || appointment?.client_id,
    collaborator_id: appointment?.collaborator_id,
    service_id: appointmentServices[0]?.service_id,
  };
}

async function resolveCommissionPercent(
  businessId: string,
  collaboratorId?: string,
  serviceId?: string,
) {
  if (!collaboratorId) return 0;

  const supabase = getSupabaseAdmin();
  if (serviceId) {
    const { data: collaboratorService } = await supabase
      .from('collaborator_services')
      .select('commission')
      .eq('business_id', businessId)
      .eq('collaborator_id', collaboratorId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (collaboratorService?.commission !== null && collaboratorService?.commission !== undefined) {
      return Number(collaboratorService.commission);
    }
  }

  const { data: collaborator } = await supabase
    .from('collaborators')
    .select('base_commission')
    .eq('business_id', businessId)
    .eq('id', collaboratorId)
    .maybeSingle();

  return Number(collaborator?.base_commission || 0);
}

export async function listFinancialRecords(businessId: string, filters: FinancialRecordFilters = {}) {
  const supabase = getSupabaseAdmin();
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 1000);
  const offset = (page - 1) * limit;

  let query = buildFinancialRecordsQuery(supabase, businessId, filters)
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: data || [], total: count || 0, page, limit };
}

export async function exportFinancialRecordsCsv(businessId: string, filters: FinancialRecordFilters = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await buildFinancialRecordsQuery(supabase, businessId, { ...filters, page: undefined, limit: undefined })
    .limit(5000);
  if (error) throw error;
  return financialRecordsToCsv((data || []) as CsvRecord[]);
}

export async function getFinancialSummary(businessId: string, filters: FinancialRecordFilters = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await buildFinancialRecordsQuery(supabase, businessId, filters);
  if (error) throw error;

  const records = data || [];
  return {
    received_total: records
      .filter((record: any) => record.type === 'income' && record.status === 'received')
      .reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0),
    pending_total: records
      .filter((record: any) => record.type === 'income' && record.status === 'pending')
      .reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0),
    commission_total: records
      .filter((record: any) => record.type === 'income' && record.status === 'received')
      .reduce((sum: number, record: any) => sum + Number(record.commission_amount || 0), 0),
    records_count: records.length,
  };
}

function buildFinancialRecordsQuery(supabase: ReturnType<typeof getSupabaseAdmin>, businessId: string, filters: FinancialRecordFilters) {
  let query = supabase
    .from('financial_records')
    .select('*, client:clients(id, name), collaborator:collaborators(id, name), service:services(id, name), appointment:appointments(id, date, start_time, status)', { count: 'exact' })
    .eq('business_id', businessId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.date_from) query = query.gte('occurred_on', filters.date_from);
  if (filters.date_to) query = query.lte('occurred_on', filters.date_to);
  if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.collaborator_id) query = query.eq('collaborator_id', filters.collaborator_id);
  if (filters.service_id) query = query.eq('service_id', filters.service_id);
  if (filters.client_id) query = query.eq('client_id', filters.client_id);

  return query;
}
