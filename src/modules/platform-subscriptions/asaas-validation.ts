export type AsaasValidationEnvironment = 'sandbox' | 'production';

export type ValidationTarget = {
  environment: AsaasValidationEnvironment;
  apiKey: string;
  canCreateSubscription: boolean;
};

type ValidationEnv = Partial<Record<
  | 'ASAAS_PLATFORM_API_KEY'
  | 'ASAAS_PLATFORM_ENV'
  | 'ASAAS_PLATFORM_SANDBOX_API_KEY'
  | 'ASAAS_PLATFORM_PRODUCTION_API_KEY'
  | 'ASAAS_PLATFORM_VALIDATE_CREATE'
  | 'ASAAS_PLATFORM_VALIDATE_PRODUCTION_CREATE',
  string
>>;

type ValidationPayloadInput = {
  customerId: string;
  value: number;
  nextDueDate: string;
  externalReference: string;
};

export function resolveValidationTargets(env: ValidationEnv): ValidationTarget[] {
  const allowCreate = env.ASAAS_PLATFORM_VALIDATE_CREATE === 'true';
  const allowProductionCreate = env.ASAAS_PLATFORM_VALIDATE_PRODUCTION_CREATE === 'true';
  const targets: ValidationTarget[] = [];

  if (env.ASAAS_PLATFORM_SANDBOX_API_KEY) {
    targets.push({
      environment: 'sandbox',
      apiKey: env.ASAAS_PLATFORM_SANDBOX_API_KEY,
      canCreateSubscription: allowCreate,
    });
  }

  if (env.ASAAS_PLATFORM_PRODUCTION_API_KEY) {
    targets.push({
      environment: 'production',
      apiKey: env.ASAAS_PLATFORM_PRODUCTION_API_KEY,
      canCreateSubscription: allowCreate && allowProductionCreate,
    });
  }

  if (targets.length === 0 && env.ASAAS_PLATFORM_API_KEY) {
    const environment = env.ASAAS_PLATFORM_ENV === 'production' ? 'production' : 'sandbox';
    targets.push({
      environment,
      apiKey: env.ASAAS_PLATFORM_API_KEY,
      canCreateSubscription: environment === 'production'
        ? allowCreate && allowProductionCreate
        : allowCreate,
    });
  }

  return targets;
}

export function buildValidationCustomerPayload(externalReference: string) {
  return {
    name: 'Sistematize Validacao Tecnica',
    email: `validacao-${externalReference}@example.com`,
    externalReference,
  };
}

export function buildValidationSubscriptionPayload(input: ValidationPayloadInput) {
  return {
    customer: input.customerId,
    billingType: 'UNDEFINED',
    cycle: 'MONTHLY',
    value: input.value,
    nextDueDate: input.nextDueDate,
    description: 'Sistematize - Validacao tecnica de assinatura',
    externalReference: input.externalReference,
  };
}
