import { getSupabaseAdmin } from '../../config/supabase.js';

export async function processPlatformWebhook(event: {
  id: string;
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    netValue: number;
    subscription?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    pixQrCode?: { payload: string; encodedImage: string };
    dueDate?: string;
    paymentDate?: string;
  };
}) {
  const supabase = getSupabaseAdmin();

  if (!event?.id || !event?.event) {
    return { ignored: true, reason: 'invalid_event' };
  }

  // Idempotency
  const { data: existing } = await supabase
    .from('platform_webhook_events')
    .select('id')
    .eq('asaas_event_id', event.id)
    .maybeSingle();

  if (existing) {
    return { ignored: true, reason: 'duplicate_event' };
  }

  const { error: insertEventError } = await supabase.from('platform_webhook_events').insert({
    asaas_event_id: event.id,
    event_type: event.event,
    payload: event,
  });
  if (insertEventError) throw insertEventError;

  const payment = event.payment;
  if (!payment?.id) {
    return { ignored: true, reason: 'no_payment_id' };
  }

  // Try to find by subscription first, then by payment
  let businessId: string | null = null;
  let subscriptionId: string | null = null;

  if (payment.subscription) {
    const { data: sub } = await supabase
      .from('platform_subscriptions')
      .select('id, business_id')
      .eq('asaas_subscription_id', payment.subscription)
      .maybeSingle();

    if (sub) {
      businessId = sub.business_id;
      subscriptionId = sub.id;
    }
  }

  if (!businessId) {
    const { data: inv } = await supabase
      .from('platform_invoices')
      .select('business_id, subscription_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (inv) {
      businessId = inv.business_id;
      subscriptionId = inv.subscription_id;
    }
  }

  if (!businessId) {
    return { ignored: true, reason: 'business_not_found' };
  }

  // Upsert invoice record
  await supabase
    .from('platform_invoices')
    .upsert({
      subscription_id: subscriptionId,
      business_id: businessId,
      asaas_payment_id: payment.id,
      value: payment.value,
      net_value: payment.netValue || null,
      status: mapPlatformPaymentStatus(payment.status),
      due_date: payment.dueDate || new Date().toISOString().split('T')[0],
      paid_at: isPlatformPaymentConfirmed(payment.status) ? (payment.paymentDate || new Date().toISOString()) : null,
      invoice_url: payment.invoiceUrl || null,
      bank_slip_url: payment.bankSlipUrl || null,
      pix_qr_code: payment.pixQrCode?.encodedImage || null,
      pix_payload: payment.pixQrCode?.payload || null,
    }, { onConflict: 'asaas_payment_id' });

  const nextBusinessStatus = getBusinessSubscriptionStatusForPlatformEvent(event.event);

  // Update subscription and business status
  if (nextBusinessStatus === 'paid') {
    if (subscriptionId) {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'active' })
        .eq('id', subscriptionId);
    }
    await supabase
      .from('businesses')
      .update({ subscription_status: 'paid' })
      .eq('id', businessId);
  }

  if (nextBusinessStatus === 'overdue') {
    if (subscriptionId) {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'overdue' })
        .eq('id', subscriptionId);
    }
    await supabase
      .from('businesses')
      .update({ subscription_status: 'overdue' })
      .eq('id', businessId);
  }

  if (event.event === 'PAYMENT_DELETED' || event.event === 'PAYMENT_REFUNDED') {
    await supabase
      .from('platform_invoices')
      .update({ status: mapPlatformPaymentStatus(payment.status) })
      .eq('asaas_payment_id', payment.id);
  }

  return { received: true };
}

export function mapPlatformPaymentStatus(asaasStatus: string): string {
  const map: Record<string, string> = {
    PENDING: 'pending',
    RECEIVED: 'received',
    CONFIRMED: 'confirmed',
    OVERDUE: 'overdue',
    REFUNDED: 'refunded',
    DELETED: 'deleted',
    CANCELLED: 'cancelled',
    RECEIVED_IN_CASH: 'received',
  };
  return map[asaasStatus] || 'pending';
}

export function isPlatformPaymentConfirmed(status: string): boolean {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status);
}

export function getBusinessSubscriptionStatusForPlatformEvent(eventName: string): 'paid' | 'overdue' | null {
  if (eventName === 'PAYMENT_CONFIRMED' || eventName === 'PAYMENT_RECEIVED') {
    return 'paid';
  }

  if (eventName === 'PAYMENT_OVERDUE') {
    return 'overdue';
  }

  return null;
}
