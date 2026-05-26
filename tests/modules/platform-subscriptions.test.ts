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
      status: 'active',
      is_default: true,
    });
  });

  it('normalizes checkout card input before sending sensitive data to Asaas', async () => {
    const { normalizeCheckoutCardPaymentInput } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(normalizeCheckoutCardPaymentInput({
      creditCard: {
        holderName: '  Cliente Teste  ',
        number: '4111 1111 1111 4444',
        expiryMonth: '7',
        expiryYear: '26',
        ccv: '12 3',
      },
      holderInfo: {
        name: '  Cliente Teste  ',
        email: ' CLIENTE@EXEMPLO.COM ',
        cpfCnpj: '060.465.885-02',
        postalCode: '41.100-800',
        addressNumber: ' 805 ',
        phone: '(71) 99235-5913',
      },
    })).toEqual({
      creditCard: {
        holderName: 'Cliente Teste',
        number: '4111111111114444',
        expiryMonth: '07',
        expiryYear: '2026',
        ccv: '123',
      },
      holderInfo: {
        name: 'Cliente Teste',
        email: 'cliente@exemplo.com',
        cpfCnpj: '06046588502',
        postalCode: '41100800',
        addressNumber: '805',
        phone: '71992355913',
      },
    });
  });

  it('builds the subscription activation patch for an immediately paid initial checkout invoice', async () => {
    const { buildImmediatePaidCheckoutEffects } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildImmediatePaidCheckoutEffects({
      invoice: { purpose: 'subscription', pending_plan_id: null, subscription_id: 'sub_123' },
      subscription: { id: 'sub_123', business_id: 'biz_123', plan_id: 'plan_123' },
    })).toEqual({
      action: 'activate_subscription',
      subscription_id: 'sub_123',
      business_id: 'biz_123',
      plan_id: 'plan_123',
    });
  });

  it('builds the pending plan change effect for an immediately paid upgrade invoice', async () => {
    const { buildImmediatePaidCheckoutEffects } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildImmediatePaidCheckoutEffects({
      invoice: { purpose: 'plan_change', pending_plan_id: 'plan_new', subscription_id: 'sub_123' },
      subscription: { id: 'sub_123', business_id: 'biz_123', plan_id: 'plan_old' },
    })).toEqual({
      action: 'apply_pending_plan_change',
      subscription_id: 'sub_123',
    });
  });

  it('builds the Asaas subscription card update payload from a stored token', async () => {
    const { buildAsaasSubscriptionCardUpdatePayload } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildAsaasSubscriptionCardUpdatePayload('tok_123', '201.10.20.30')).toEqual({
      creditCardToken: 'tok_123',
      remoteIp: '201.10.20.30',
    });
  });

  it('sanitizes stored payment methods before returning them to the dashboard', async () => {
    const { sanitizePaymentMethodForClient } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(sanitizePaymentMethodForClient({
      id: 'pm_123',
      holder_name: 'Cliente Teste',
      card_brand: 'VISA',
      card_last4: '4444',
      is_default: true,
      status: 'active',
      created_at: '2026-05-26T00:00:00.000Z',
      asaas_credit_card_token: 'tok_secret',
    })).toEqual({
      id: 'pm_123',
      holder_name: 'Cliente Teste',
      card_brand: 'VISA',
      card_last4: '4444',
      is_default: true,
      status: 'active',
      created_at: '2026-05-26T00:00:00.000Z',
      updated_at: undefined,
      last_used_at: null,
    });
  });

  it('builds retry schedule using conservative D+1, D+3 and D+5 windows', async () => {
    const { calculateBillingRetrySchedule } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(calculateBillingRetrySchedule(0, '2026-05-26T10:00:00.000Z')).toEqual({
      retry_count: 1,
      next_retry_at: '2026-05-27T10:00:00.000Z',
      exhausted: false,
    });

    expect(calculateBillingRetrySchedule(2, '2026-05-26T10:00:00.000Z')).toEqual({
      retry_count: 3,
      next_retry_at: '2026-05-31T10:00:00.000Z',
      exhausted: false,
    });

    expect(calculateBillingRetrySchedule(3, '2026-05-26T10:00:00.000Z')).toEqual({
      retry_count: 3,
      next_retry_at: null,
      exhausted: true,
    });
  });

  it('builds safe billing audit events without card secrets', async () => {
    const { buildBillingEventRecord } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildBillingEventRecord({
      businessId: 'biz_123',
      subscriptionId: 'sub_123',
      invoiceId: 'inv_123',
      paymentMethodId: 'pm_123',
      eventType: 'card_payment_failed',
      severity: 'warn',
      message: 'Pagamento recusado',
      metadata: {
        creditCardToken: 'tok_secret',
        ccv: '123',
        cardNumber: '4111111111114444',
        reason: 'insufficient_funds',
      },
    })).toEqual({
      business_id: 'biz_123',
      subscription_id: 'sub_123',
      invoice_id: 'inv_123',
      payment_method_id: 'pm_123',
      event_type: 'card_payment_failed',
      severity: 'warn',
      message: 'Pagamento recusado',
      metadata: {
        reason: 'insufficient_funds',
      },
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

  it('treats refused invoices as retryable platform billing invoices', async () => {
    const { isRetryablePlatformInvoiceStatus } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(isRetryablePlatformInvoiceStatus('pending')).toBe(true);
    expect(isRetryablePlatformInvoiceStatus('overdue')).toBe(true);
    expect(isRetryablePlatformInvoiceStatus('refused')).toBe(true);
    expect(isRetryablePlatformInvoiceStatus('confirmed')).toBe(false);
    expect(isRetryablePlatformInvoiceStatus('received')).toBe(false);
    expect(isRetryablePlatformInvoiceStatus(null)).toBe(false);
  });

  it('builds an operational billing summary for admin support', async () => {
    const { buildAdminBillingOperationsSummary } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildAdminBillingOperationsSummary({
      now: '2026-05-26T12:00:00.000Z',
      invoices: [
        { id: 'inv_pending', status: 'pending', value: 49.9, retry_count: 0, next_retry_at: '2026-05-26T11:00:00.000Z' },
        { id: 'inv_overdue', status: 'overdue', value: 99.9, retry_count: 3, next_retry_at: null },
        { id: 'inv_refused', status: 'refused', value: 199.9, retry_count: 2, next_retry_at: '2026-05-27T12:00:00.000Z' },
        { id: 'inv_paid', status: 'confirmed', value: 49.9, retry_count: 0, next_retry_at: null },
      ],
      events: [
        { severity: 'info' },
        { severity: 'warn' },
        { severity: 'error' },
      ],
      paymentMethods: [
        { failed_attempts: 0 },
        { failed_attempts: 2 },
      ],
    })).toEqual({
      open_amount: 349.7,
      retryable_count: 3,
      pending_count: 1,
      overdue_count: 1,
      refused_count: 1,
      exhausted_retry_count: 1,
      due_retry_count: 1,
      warning_event_count: 1,
      error_event_count: 1,
      failing_payment_method_count: 1,
    });
  });

  it('normalizes admin billing period filters for inclusive date ranges', async () => {
    const { normalizeAdminBillingPeriodFilters } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(normalizeAdminBillingPeriodFilters({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    })).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });

    expect(normalizeAdminBillingPeriodFilters({
      dateFrom: 'invalid',
      dateTo: '',
    })).toEqual({});
  });

  it('builds a safe CSV export for billing invoices', async () => {
    const { buildBillingInvoicesCsv } = await import('../../src/modules/platform-subscriptions/service.js');

    const csv = buildBillingInvoicesCsv([
      {
        asaas_payment_id: 'pay_123',
        business: { name: 'Studio "Prime", Centro', slug: 'studio-prime' },
        value: 99.9,
        status: 'refused',
        operational_status: 'in_review',
        due_date: '2026-05-26',
        billing_type: 'CREDIT_CARD',
        retry_count: 2,
        last_failure_message: 'Cartao recusado, tente outro',
      },
    ]);

    expect(csv.split('\n')[0]).toBe('fatura,empresa,slug,valor,status,analise_operacional,vencimento,forma_pagamento,tentativas,ultima_falha');
    expect(csv).toContain('in_review');
    expect(csv).toContain('"Studio ""Prime"", Centro"');
    expect(csv).toContain('"Cartao recusado, tente outro"');
  });

  it('normalizes admin billing search text without keeping punctuation noise', async () => {
    const { normalizeAdminBillingSearch } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(normalizeAdminBillingSearch('  Studio Prime  ')).toBe('Studio Prime');
    expect(normalizeAdminBillingSearch('06.047.958/0001-50')).toBe('06047958000150');
    expect(normalizeAdminBillingSearch('%_(),.\"')).toBe('');
  });

  it('builds an operational review patch without changing the financial status', async () => {
    const { buildBillingInvoiceReviewPatch } = await import('../../src/modules/platform-subscriptions/service.js');

    expect(buildBillingInvoiceReviewPatch({
      reviewStatus: 'in_review',
      note: 'Cliente pediu prazo ate sexta.',
      reviewedBy: 'admin_123',
      currentMetadata: { existing: true },
    })).toEqual({
      operational_status: 'in_review',
      operational_note: 'Cliente pediu prazo ate sexta.',
      operational_reviewed_by: 'admin_123',
      operational_reviewed_at: expect.any(String),
      operational_metadata: { existing: true },
    });
  });
});
