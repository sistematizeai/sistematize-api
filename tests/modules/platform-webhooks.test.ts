import { describe, expect, it } from 'vitest';

describe('Platform webhook helpers', () => {
  it('classifies paid and overdue webhook events for business status updates', async () => {
    const { getBusinessSubscriptionStatusForPlatformEvent } = await import('../../src/modules/webhooks/platform-service.js');

    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_CONFIRMED')).toBe('paid');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_RECEIVED')).toBe('paid');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_OVERDUE')).toBe('overdue');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_REFUNDED')).toBeNull();
  });

  it('classifies reversal and refusal platform events for billing risk handling', async () => {
    const { getPlatformBillingRiskAction } = await import('../../src/modules/webhooks/platform-service.js');

    expect(getPlatformBillingRiskAction('PAYMENT_REFUNDED')).toBe('reversal');
    expect(getPlatformBillingRiskAction('PAYMENT_CHARGEBACK_REQUESTED')).toBe('reversal');
    expect(getPlatformBillingRiskAction('PAYMENT_DELETED')).toBe('deleted');
    expect(getPlatformBillingRiskAction('PAYMENT_CREDIT_CARD_REFUSED')).toBe('card_refused');
  });

  it('maps paid Asaas payment statuses to local invoice status', async () => {
    const { mapPlatformPaymentStatus, isPlatformPaymentConfirmed } = await import('../../src/modules/webhooks/platform-service.js');

    expect(mapPlatformPaymentStatus('RECEIVED')).toBe('received');
    expect(mapPlatformPaymentStatus('CONFIRMED')).toBe('confirmed');
    expect(mapPlatformPaymentStatus('RECEIVED_IN_CASH')).toBe('received');
    expect(isPlatformPaymentConfirmed('RECEIVED_IN_CASH')).toBe(true);
  });

  it('maps overdue and cancelled Asaas payment statuses explicitly', async () => {
    const { mapPlatformPaymentStatus, isPlatformPaymentConfirmed } = await import('../../src/modules/webhooks/platform-service.js');

    expect(mapPlatformPaymentStatus('OVERDUE')).toBe('overdue');
    expect(mapPlatformPaymentStatus('CANCELLED')).toBe('cancelled');
    expect(mapPlatformPaymentStatus('REFUSED')).toBe('refused');
    expect(isPlatformPaymentConfirmed('OVERDUE')).toBe(false);
  });

  it('applies paid upgrade invoices immediately but waits for downgrade effective date', async () => {
    const { shouldApplyPendingPlanChange } = await import('../../src/modules/webhooks/platform-service.js');

    expect(shouldApplyPendingPlanChange({
      pending_change_type: 'upgrade',
      pending_effective_at: '2026-06-26',
    }, '2026-05-26')).toBe(true);

    expect(shouldApplyPendingPlanChange({
      pending_change_type: 'downgrade',
      pending_effective_at: '2026-06-26',
    }, '2026-05-26')).toBe(false);

    expect(shouldApplyPendingPlanChange({
      pending_change_type: 'downgrade',
      pending_effective_at: '2026-06-26',
    }, '2026-06-26')).toBe(true);
  });
});
