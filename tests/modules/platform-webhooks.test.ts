import { describe, expect, it } from 'vitest';

describe('Platform webhook helpers', () => {
  it('classifies paid and overdue webhook events for business status updates', async () => {
    const { getBusinessSubscriptionStatusForPlatformEvent } = await import('../../src/modules/webhooks/platform-service.js');

    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_CONFIRMED')).toBe('paid');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_RECEIVED')).toBe('paid');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_OVERDUE')).toBe('overdue');
    expect(getBusinessSubscriptionStatusForPlatformEvent('PAYMENT_REFUNDED')).toBeNull();
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
    expect(isPlatformPaymentConfirmed('OVERDUE')).toBe(false);
  });
});
