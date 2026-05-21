import 'dotenv/config';
import { asaasRequest, validateAsaasApiKey } from '../src/utils/asaas-client.js';
import {
  buildValidationCustomerPayload,
  buildValidationSubscriptionPayload,
  resolveValidationTargets,
} from '../src/modules/platform-subscriptions/asaas-validation.js';

function nextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

async function validateTarget(target: ReturnType<typeof resolveValidationTargets>[number]) {
  const externalReference = `sistematize-validation-${target.environment}-${Date.now()}`;
  console.log(`[${target.environment}] Validando chave Asaas...`);
  const account = await validateAsaasApiKey(target.apiKey, target.environment);
  console.log(`[${target.environment}] Conta OK: ${account.id}`);

  if (!target.canCreateSubscription) {
    console.log(`[${target.environment}] Criacao de assinatura pulada. Defina ASAAS_PLATFORM_VALIDATE_CREATE=true${target.environment === 'production' ? ' e ASAAS_PLATFORM_VALIDATE_PRODUCTION_CREATE=true' : ''} para executar.`);
    return;
  }

  console.log(`[${target.environment}] Criando cliente tecnico temporario...`);
  const customer = await asaasRequest<{ id: string }>({
    apiKey: target.apiKey,
    environment: target.environment,
    path: '/customers',
    method: 'POST',
    body: buildValidationCustomerPayload(externalReference),
  });

  let subscriptionId: string | null = null;
  try {
    console.log(`[${target.environment}] Criando assinatura tecnica temporaria...`);
    const subscription = await asaasRequest<{ id: string; status: string; nextDueDate?: string }>({
      apiKey: target.apiKey,
      environment: target.environment,
      path: '/subscriptions',
      method: 'POST',
      body: buildValidationSubscriptionPayload({
        customerId: customer.id,
        value: 5,
        nextDueDate: nextDueDate(),
        externalReference,
      }),
    });

    subscriptionId = subscription.id;
    console.log(`[${target.environment}] Assinatura criada: ${subscription.id} (${subscription.status})`);
  } finally {
    if (subscriptionId) {
      console.log(`[${target.environment}] Removendo assinatura tecnica temporaria...`);
      await asaasRequest({
        apiKey: target.apiKey,
        environment: target.environment,
        path: `/subscriptions/${subscriptionId}`,
        method: 'DELETE',
      });
    }
  }
}

async function main() {
  const targets = resolveValidationTargets(process.env);

  if (targets.length === 0) {
    throw new Error('Nenhuma chave encontrada. Configure ASAAS_PLATFORM_SANDBOX_API_KEY e/ou ASAAS_PLATFORM_PRODUCTION_API_KEY.');
  }

  for (const target of targets) {
    await validateTarget(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
