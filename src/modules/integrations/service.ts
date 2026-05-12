import { getSupabaseAdmin } from '../../config/supabase.js';
import { loadEnv } from '../../config/env.js';
import { encrypt, decrypt, generateWebhookToken } from '../../utils/crypto.js';
import { validateAsaasApiKey, asaasRequest } from '../../utils/asaas-client.js';
import { NotFoundError, AppError } from '../../utils/errors.js';

type AsaasEnv = 'sandbox' | 'production';

export async function connectAsaas(businessId: string, apiKey: string, environment: AsaasEnv) {
  const account = await validateAsaasApiKey(apiKey, environment);

  const apiKeyLast4 = apiKey.slice(-4);
  const apiKeyEncrypted = encrypt(apiKey);

  const webhookToken = generateWebhookToken();
  const env = loadEnv();
  const webhookUrl = `${env.NODE_ENV === 'production' ? 'https://sistematize-api.onrender.com' : `http://localhost:${env.PORT}`}/webhooks/asaas`;

  let webhookId: string | null = null;
  try {
    const webhook = await asaasRequest<{ id: string }>({
      apiKey,
      environment,
      path: '/webhooks',
      method: 'POST',
      body: {
        name: 'Sistematize - Pagamentos',
        url: webhookUrl,
        enabled: true,
        interrupted: false,
        authToken: webhookToken,
        sendType: 'SEQUENTIALLY',
        events: [
          'PAYMENT_CREATED',
          'PAYMENT_UPDATED',
          'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED',
          'PAYMENT_OVERDUE',
          'PAYMENT_DELETED',
          'PAYMENT_REFUNDED',
        ],
      },
    });
    webhookId = webhook.id;
  } catch {
    // Webhook creation is best-effort; connection still valid
  }

  const webhookAuthEncrypted = encrypt(webhookToken);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_connections')
    .upsert(
      {
        business_id: businessId,
        environment,
        api_key_encrypted: apiKeyEncrypted,
        api_key_last4: apiKeyLast4,
        wallet_id: account.walletId || null,
        asaas_account_id: account.id || null,
        webhook_id: webhookId,
        webhook_url: webhookUrl,
        webhook_auth_token_encrypted: webhookAuthEncrypted,
        status: 'connected',
        last_tested_at: new Date().toISOString(),
        disconnected_at: null,
      },
      { onConflict: 'business_id,environment' },
    )
    .select('id, status, environment, api_key_last4, webhook_id, last_tested_at')
    .single();

  if (error) throw error;
  return data;
}

export async function getAsaasStatus(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_connections')
    .select('id, status, environment, api_key_last4, webhook_id, webhook_url, last_tested_at, disconnected_at')
    .eq('business_id', businessId)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { connected: false };
  }

  return {
    connected: true,
    status: data.status,
    environment: data.environment,
    apiKeyLast4: data.api_key_last4,
    webhookActive: !!data.webhook_id,
    lastTestedAt: data.last_tested_at,
  };
}

export async function testAsaasConnection(businessId: string) {
  const connection = await getConnection(businessId);
  const apiKey = decrypt(connection.api_key_encrypted);

  await validateAsaasApiKey(apiKey, connection.environment as AsaasEnv);

  const supabase = getSupabaseAdmin();
  await supabase
    .from('asaas_connections')
    .update({ last_tested_at: new Date().toISOString(), status: 'connected' })
    .eq('id', connection.id);

  return { success: true, testedAt: new Date().toISOString() };
}

export async function disconnectAsaas(businessId: string) {
  const connection = await getConnection(businessId);

  // Try to delete webhook on Asaas side
  if (connection.webhook_id) {
    try {
      const apiKey = decrypt(connection.api_key_encrypted);
      await asaasRequest({
        apiKey,
        environment: connection.environment as AsaasEnv,
        path: `/webhooks/${connection.webhook_id}`,
        method: 'DELETE',
      });
    } catch {
      // Best-effort cleanup
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('asaas_connections')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('id', connection.id);

  if (error) throw error;
}

export async function recreateWebhook(businessId: string) {
  const connection = await getConnection(businessId);
  const apiKey = decrypt(connection.api_key_encrypted);
  const environment = connection.environment as AsaasEnv;

  // Delete old webhook if exists
  if (connection.webhook_id) {
    try {
      await asaasRequest({ apiKey, environment, path: `/webhooks/${connection.webhook_id}`, method: 'DELETE' });
    } catch {
      // ignore
    }
  }

  const webhookToken = generateWebhookToken();
  const env = loadEnv();
  const webhookUrl = `${env.NODE_ENV === 'production' ? 'https://sistematize-api.onrender.com' : `http://localhost:${env.PORT}`}/webhooks/asaas`;

  const webhook = await asaasRequest<{ id: string }>({
    apiKey,
    environment,
    path: '/webhooks',
    method: 'POST',
    body: {
      name: 'Sistematize - Pagamentos',
      url: webhookUrl,
      enabled: true,
      interrupted: false,
      authToken: webhookToken,
      sendType: 'SEQUENTIALLY',
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_UPDATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
      ],
    },
  });

  const supabase = getSupabaseAdmin();
  await supabase
    .from('asaas_connections')
    .update({
      webhook_id: webhook.id,
      webhook_url: webhookUrl,
      webhook_auth_token_encrypted: encrypt(webhookToken),
    })
    .eq('id', connection.id);

  return { webhookId: webhook.id, webhookUrl };
}

export async function getConnection(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_connections')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError('Integracao Asaas nao encontrada. Conecte sua conta primeiro.');
  return data;
}

export async function getConnectionByBusinessId(businessId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('asaas_connections')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  return data;
}
