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
      status: 'pending',
      due_date: '2026-05-26',
      invoice_url: 'https://sandbox.asaas.com/i/pay_123',
      bank_slip_url: null,
      billing_type: 'PIX',
    });
  });

  it('normalizes Asaas payment status before writing platform invoices', async () => {
    const { buildPlatformInvoiceRecord } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildPlatformInvoiceRecord({
      businessId: 'biz_123',
      subscriptionId: 'sub_local_123',
      payment: {
        id: 'pay_123',
        value: 99.9,
        status: 'PENDING',
        dueDate: '2026-05-26',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        bankSlipUrl: null,
        billingType: 'UNDEFINED',
      },
      fallbackValue: 99.9,
      fallbackDueDate: '2026-05-26',
      requestedBillingType: 'UNDEFINED',
    }).status).toBe('pending');
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

  it('classifies plan changes by selected billing value', async () => {
    const { classifyPlanChange } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(classifyPlanChange(99.9, 199.9)).toBe('upgrade');
    expect(classifyPlanChange(199.9, 99.9)).toBe('downgrade');
    expect(classifyPlanChange(99.9, 99.9)).toBe('same');
  });

  it('charges only the immediate increase when upgrading a plan', async () => {
    const { calculateImmediateUpgradeCharge } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(calculateImmediateUpgradeCharge(99.9, 199.9)).toBe(100);
    expect(calculateImmediateUpgradeCharge(199.9, 99.9)).toBe(0);
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

  it('builds internal checkout URLs for platform invoices', async () => {
    const { buildSubscriptionCheckoutUrl } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildSubscriptionCheckoutUrl('7d2ab1f7-3b0d-4e9f-83f0-2dece7be0d91')).toBe(
      '/dashboard/checkout/7d2ab1f7-3b0d-4e9f-83f0-2dece7be0d91',
    );
  });

  it('stores only safe card metadata from Asaas tokenization', async () => {
    const { buildStoredPaymentMethodRecord } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildStoredPaymentMethodRecord({
      businessId: 'biz_123',
      customerId: 'cus_123',
      tokenization: {
        creditCardToken: 'tok_123',
        creditCardBrand: 'VISA',
        creditCardNumber: '4444',
      },
      holderName: 'Cliente Teste',
      rawCardNumber: '4111111111114444',
    })).toEqual({
      business_id: 'biz_123',
      customer_id: 'cus_123',
      asaas_credit_card_token: 'tok_123',
      holder_name: 'Cliente Teste',
      card_brand: 'VISA',
      card_last4: '4444',
      is_default: true,
    });
  });

  it('treats pending billing states as current subscriptions to prevent duplicate signups', async () => {
    const { getCurrentSubscriptionStatuses } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(getCurrentSubscriptionStatuses()).toEqual([
      'pending_payment',
      'active',
      'overdue',
      'past_due',
      'cancel_at_period_end',
    ]);
  });

  it('builds a reusable checkout response for an existing pending invoice', async () => {
    const { buildPendingInvoiceCheckoutResponse } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildPendingInvoiceCheckoutResponse({
      id: 'inv_123',
      invoice_url: 'https://www.asaas.com/i/inv_123',
      bank_slip_url: 'https://www.asaas.com/b/pdf/inv_123',
    })).toEqual({
      reused: true,
      pending: true,
      payment_url: 'https://www.asaas.com/i/inv_123',
      checkout_url: '/dashboard/checkout/inv_123',
      invoice: {
        id: 'inv_123',
        invoice_url: 'https://www.asaas.com/i/inv_123',
        bank_slip_url: 'https://www.asaas.com/b/pdf/inv_123',
      },
    });
  });
});
