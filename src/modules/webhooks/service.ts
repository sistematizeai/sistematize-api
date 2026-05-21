import { getSupabaseAdmin } from '../../config/supabase.js';
import { decrypt } from '../../utils/crypto.js';
import { upsertAsaasFinancialRecord } from '../financial/service.js';

const STATUS_MAP: Record<string, string> = {
  PENDING: 'waiting',
  RECEIVED: 'received',
  CONFIRMED: 'confirmed',
  OVERDUE: 'overdue',
  REFUNDED: 'refunded',
  RECEIVED_IN_CASH: 'received',
};

export async function processAsaasWebhook(receivedToken: string | undefined, event: {
  id: string;
  event: string;
  payment?: { id: string; status: string; value: number; netValue: number };
}) {
  const supabase = getSupabaseAdmin();

  if (!event?.id || !event?.event) {
    return { ignored: true, reason: 'invalid_event' };
  }

  const paymentId = event.payment?.id;
  if (!paymentId) {
    return { ignored: true, reason: 'no_payment_id' };
  }

  const { data: localPayment } = await supabase
    .from('asaas_payments')
    .select('*')
    .eq('asaas_payment_id', paymentId)
    .maybeSingle();

  if (!localPayment) {
    return { ignored: true, reason: 'payment_not_found' };
  }

  // Validate webhook token
  const { data: connection } = await supabase
    .from('asaas_connections')
    .select('webhook_auth_token_encrypted')
    .eq('business_id', localPayment.business_id)
    .eq('status', 'connected')
    .maybeSingle();

  if (connection?.webhook_auth_token_encrypted && receivedToken) {
    const expectedToken = decrypt(connection.webhook_auth_token_encrypted);
    if (receivedToken !== expectedToken) {
      return { error: true, reason: 'unauthorized' };
    }
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from('asaas_webhook_events')
    .select('id')
    .eq('asaas_event_id', event.id)
    .maybeSingle();

  if (existing) {
    return { ignored: true, reason: 'duplicate_event' };
  }

  // Save event
  await supabase.from('asaas_webhook_events').insert({
    business_id: localPayment.business_id,
    asaas_event_id: event.id,
    event_type: event.event,
    payment_id: paymentId,
    payload: event,
  });

  // Process
  await processPaymentEvent(event.event, event.payment!, localPayment);

  // Mark processed
  await supabase
    .from('asaas_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('asaas_event_id', event.id);

  return { received: true };
}

async function processPaymentEvent(
  eventType: string,
  asaasPayment: { id: string; status: string; value: number; netValue: number },
  localPayment: {
    id: string;
    business_id: string;
    appointment_id: string | null;
    client_id?: string | null;
    value?: number;
    due_date?: string;
  },
) {
  const supabase = getSupabaseAdmin();

  if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
    await supabase
      .from('asaas_payments')
      .update({ status: asaasPayment.status, net_value: asaasPayment.netValue })
      .eq('id', localPayment.id);

    if (localPayment.appointment_id) {
      await supabase
        .from('appointments')
        .update({ payment_status: 'received', status: 'confirmed' })
        .eq('id', localPayment.appointment_id);
    }

    await supabase.from('audit_logs').insert({
      business_id: localPayment.business_id,
      action: 'appointment.confirmed_by_payment',
      entity_type: 'appointment',
      entity_id: localPayment.appointment_id,
      new_data: { asaas_payment_id: asaasPayment.id, event: eventType },
    });

    await upsertAsaasFinancialRecord({
      business_id: localPayment.business_id,
      asaas_payment_row_id: localPayment.id,
      appointment_id: localPayment.appointment_id,
      client_id: localPayment.client_id || null,
      value: asaasPayment.value || Number(localPayment.value || 0),
      status: asaasPayment.status,
      due_date: localPayment.due_date || new Date().toISOString().split('T')[0],
    });

    return;
  }

  if (eventType === 'PAYMENT_OVERDUE') {
    await supabase
      .from('asaas_payments')
      .update({ status: 'OVERDUE' })
      .eq('id', localPayment.id);

    if (localPayment.appointment_id) {
      await supabase
        .from('appointments')
        .update({ payment_status: 'overdue' })
        .eq('id', localPayment.appointment_id);
    }
    await upsertAsaasFinancialRecord({
      business_id: localPayment.business_id,
      asaas_payment_row_id: localPayment.id,
      appointment_id: localPayment.appointment_id,
      client_id: localPayment.client_id || null,
      value: asaasPayment.value || Number(localPayment.value || 0),
      status: 'OVERDUE',
      due_date: localPayment.due_date || new Date().toISOString().split('T')[0],
    });
    return;
  }

  if (eventType === 'PAYMENT_REFUNDED') {
    await supabase
      .from('asaas_payments')
      .update({ status: 'REFUNDED' })
      .eq('id', localPayment.id);

    if (localPayment.appointment_id) {
      await supabase
        .from('appointments')
        .update({ payment_status: 'refunded' })
        .eq('id', localPayment.appointment_id);
    }
    await upsertAsaasFinancialRecord({
      business_id: localPayment.business_id,
      asaas_payment_row_id: localPayment.id,
      appointment_id: localPayment.appointment_id,
      client_id: localPayment.client_id || null,
      value: asaasPayment.value || Number(localPayment.value || 0),
      status: 'REFUNDED',
      due_date: localPayment.due_date || new Date().toISOString().split('T')[0],
    });
    return;
  }

  if (eventType === 'PAYMENT_DELETED') {
    await supabase
      .from('asaas_payments')
      .update({ status: 'DELETED' })
      .eq('id', localPayment.id);

    if (localPayment.appointment_id) {
      await supabase
        .from('appointments')
        .update({ payment_status: 'cancelled' })
        .eq('id', localPayment.appointment_id);
    }
    await upsertAsaasFinancialRecord({
      business_id: localPayment.business_id,
      asaas_payment_row_id: localPayment.id,
      appointment_id: localPayment.appointment_id,
      client_id: localPayment.client_id || null,
      value: asaasPayment.value || Number(localPayment.value || 0),
      status: 'DELETED',
      due_date: localPayment.due_date || new Date().toISOString().split('T')[0],
    });
    return;
  }

  // PAYMENT_CREATED, PAYMENT_UPDATED — just sync status
  await supabase
    .from('asaas_payments')
    .update({ status: asaasPayment.status })
    .eq('id', localPayment.id);

  const mappedStatus = STATUS_MAP[asaasPayment.status];
  if (mappedStatus && localPayment.appointment_id) {
    await supabase
      .from('appointments')
      .update({ payment_status: mappedStatus })
      .eq('id', localPayment.appointment_id);
  }

  await upsertAsaasFinancialRecord({
    business_id: localPayment.business_id,
    asaas_payment_row_id: localPayment.id,
    appointment_id: localPayment.appointment_id,
    client_id: localPayment.client_id || null,
    value: asaasPayment.value || Number(localPayment.value || 0),
    status: asaasPayment.status,
    due_date: localPayment.due_date || new Date().toISOString().split('T')[0],
  });
}
