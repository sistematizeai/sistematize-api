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
  return asaasRequest<{ id: string; name: string; walletId: string }>({
    apiKey,
    environment,
    path: '/myAccount',
  });
}
