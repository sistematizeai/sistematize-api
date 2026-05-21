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
