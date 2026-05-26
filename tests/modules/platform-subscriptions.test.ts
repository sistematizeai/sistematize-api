import { describe, expect, it } from 'vitest';

describe('Platform subscriptions hardening', () => {
  it('exposes subscribe, upgrade and cancel service operations', async () => {
    const service = await import('../../src/modules/platform-subscriptions/service.js');

    expect(typeof service.createSubscription).toBe('function');
    expect(typeof service.upgradeSubscription).toBe('function');
    expect(typeof service.cancelSubscription).toBe('function');
    expect(typeof service.getAsaasPaymentUrl).toBe('function');
  });

  it('prefers the Asaas invoice URL as the hosted payment URL', async () => {
    const { getAsaasPaymentUrl } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(getAsaasPaymentUrl({
      invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
      bankSlipUrl: 'https://sandbox.asaas.com/b/pdf_123',
    })).toBe('https://sandbox.asaas.com/i/pay_123');
  });

  it('falls back to the bank slip URL when invoice URL is unavailable', async () => {
    const { getAsaasPaymentUrl } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(getAsaasPaymentUrl({
      invoiceUrl: null,
      bankSlipUrl: 'https://sandbox.asaas.com/b/pdf_123',
    })).toBe('https://sandbox.asaas.com/b/pdf_123');
  });

  it('builds the first invoice record with the returned Asaas billing type', async () => {
    const { buildPlatformInvoiceRecord } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildPlatformInvoiceRecord({
      businessId: 'biz_123',
      subscriptionId: 'sub_local_123',
      payment: {
        id: 'pay_123',
        value: 99.9,
        netValue: 96.2,
        status: 'PENDING',
        dueDate: '2026-05-26',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        bankSlipUrl: null,
        billingType: 'PIX',
      },
      fallbackValue: 99.9,
      fallbackDueDate: '2026-05-26',
      requestedBillingType: 'UNDEFINED',
    })).toEqual({
      business_id: 'biz_123',
      subscription_id: 'sub_local_123',
      asaas_payment_id: 'pay_123',
      value: 99.9,
      net_value: 96.2,
      status: 'PENDING',
      due_date: '2026-05-26',
      invoice_url: 'https://sandbox.asaas.com/i/pay_123',
      bank_slip_url: null,
      billing_type: 'PIX',
    });
  });

  it('keeps restricted business statuses until payment is confirmed', async () => {
    const { resolveBusinessStatusAfterSubscriptionCreated } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(resolveBusinessStatusAfterSubscriptionCreated('trial')).toBe('trial');
    expect(resolveBusinessStatusAfterSubscriptionCreated('blocked')).toBe('blocked');
    expect(resolveBusinessStatusAfterSubscriptionCreated('overdue')).toBe('overdue');
    expect(resolveBusinessStatusAfterSubscriptionCreated('cancelled')).toBe('cancelled');
    expect(resolveBusinessStatusAfterSubscriptionCreated('paid')).toBe('active');
    expect(resolveBusinessStatusAfterSubscriptionCreated('active')).toBe('active');
  });

  it('rejects a plan that does not cover the current business usage', async () => {
    const { assertPlanCoversUsageSnapshot } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(() => assertPlanCoversUsageSnapshot({
      max_collaborators: 2,
      max_services: 5,
      max_appointments_month: 20,
    }, {
      collaborators: 3,
      services: 5,
      appointmentsThisMonth: 10,
    })).toThrow('Plano selecionado nao cobre o uso atual');
  });

  it('allows a plan when every current usage counter fits the selected limits', async () => {
    const { assertPlanCoversUsageSnapshot } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(assertPlanCoversUsageSnapshot({
      max_collaborators: 3,
      max_services: 5,
      max_appointments_month: 20,
    }, {
      collaborators: 3,
      services: 5,
      appointmentsThisMonth: 20,
    })).toEqual({ allowed: true });
  });
});
