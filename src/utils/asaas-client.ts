import { AppError } from './errors.js';

type AsaasEnvironment = 'sandbox' | 'production';

const BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: 'https://sandbox.asaas.com/api/v3',
  production: 'https://api.asaas.com/v3',
};

interface AsaasRequestOptions {
  apiKey: string;
  environment: AsaasEnvironment;
  path: string;
  method?: string;
  body?: unknown;
}

interface AsaasAccount {
  id: string;
  name: string;
  walletId?: string | null;
}

interface AsaasWalletResponse {
  walletId?: string | null;
  id?: string | null;
  data?: Array<{
    walletId?: string | null;
    id?: string | null;
  }>;
}

export async function asaasRequest<T = unknown>({
  apiKey,
  environment,
  path,
  method = 'GET',
  body,
}: AsaasRequestOptions): Promise<T> {
  const url = `${BASE_URLS[environment]}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = data?.errors?.[0]?.description || `Asaas API error: ${response.status}`;
    throw new AppError(response.status >= 500 ? 502 : 422, msg, 'ASAAS_API_ERROR');
  }

  return data as T;
}

export async function validateAsaasApiKey(apiKey: string, environment: AsaasEnvironment) {
  const account = await asaasRequest<AsaasAccount>({
    apiKey,
    environment,
    path: '/myAccount',
  });

  if (account.walletId) {
    return account;
  }

  return {
    ...account,
    walletId: await retrieveAsaasWalletId(apiKey, environment),
  };
}

export async function retrieveAsaasWalletId(apiKey: string, environment: AsaasEnvironment): Promise<string | null> {
  const wallet = await asaasRequest<AsaasWalletResponse>({
    apiKey,
    environment,
    path: '/wallets/',
  });

  const firstWallet = wallet.data?.find((entry) => entry.walletId || entry.id);
  return wallet.walletId || wallet.id || firstWallet?.walletId || firstWallet?.id || null;
}
