import { describe, expect, it } from 'vitest';

describe('Platform Asaas subscription validation harness', () => {
  it('requires explicit confirmation before creating a production subscription', async () => {
    const { resolveValidationTargets } = await import('../../src/modules/platform-subscriptions/asaas-validation.js');

    const targets = resolveValidationTargets({
      ASAAS_PLATFORM_SANDBOX_API_KEY: 'sandbox-key',
      ASAAS_PLATFORM_PRODUCTION_API_KEY: 'production-key',
      ASAAS_PLATFORM_VALIDATE_CREATE: 'true',
    });

    expect(targets).toEqual([
      { environment: 'sandbox', apiKey: 'sandbox-key', canCreateSubscription: true },
      { environment: 'production', apiKey: 'production-key', canCreateSubscription: false },
    ]);
  });

  it('builds the same subscription payload shape used by the platform billing flow', async () => {
    const { buildValidationSubscriptionPayload } = await import('../../src/modules/platform-subscriptions/asaas-validation.js');

    expect(buildValidationSubscriptionPayload({
      customerId: 'cus_123',
      value: 19.9,
      nextDueDate: '2026-05-21',
      externalReference: 'validation-123',
    })).toEqual({
      customer: 'cus_123',
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value: 19.9,
      nextDueDate: '2026-05-21',
      description: 'Sistematize - Validacao tecnica de assinatura',
      externalReference: 'validation-123',
    });
  });
});
