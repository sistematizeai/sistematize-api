import { afterEach, describe, expect, it, vi } from 'vitest';

const okResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);

describe('asaas-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates an API key using walletId returned by myAccount', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await okResponse({ id: 'acc_123', name: 'Conta Asaas', walletId: 'wallet-main' }),
    );

    const { validateAsaasApiKey } = await import('../../src/utils/asaas-client.js');

    await expect(validateAsaasApiKey('api-key', 'production')).resolves.toMatchObject({
      id: 'acc_123',
      walletId: 'wallet-main',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recovers walletId from wallets endpoint when myAccount omits it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await okResponse({ id: 'acc_123', name: 'Conta Asaas' }))
      .mockResolvedValueOnce(await okResponse({ data: [{ walletId: 'wallet-recovered' }] }));

    const { validateAsaasApiKey } = await import('../../src/utils/asaas-client.js');

    await expect(validateAsaasApiKey('api-key', 'production')).resolves.toMatchObject({
      id: 'acc_123',
      walletId: 'wallet-recovered',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.asaas.com/v3/wallets/');
  });

  it('recovers walletId from wallets endpoint id field returned by Asaas', async () => {
    vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await okResponse({ id: 'acc_123', name: 'Conta Asaas' }))
      .mockResolvedValueOnce(await okResponse({ data: [{ object: 'wallet', id: 'wallet-id-field' }] }));

    const { validateAsaasApiKey } = await import('../../src/utils/asaas-client.js');

    await expect(validateAsaasApiKey('api-key', 'production')).resolves.toMatchObject({
      id: 'acc_123',
      walletId: 'wallet-id-field',
    });
  });

  it('keeps walletId null when Asaas does not expose a wallet for the key', async () => {
    vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(await okResponse({ id: 'acc_123', name: 'Conta Asaas' }))
      .mockResolvedValueOnce(await okResponse({ object: 'list', data: [] }));

    const { validateAsaasApiKey } = await import('../../src/utils/asaas-client.js');

    await expect(validateAsaasApiKey('api-key', 'production')).resolves.toMatchObject({
      id: 'acc_123',
      walletId: null,
    });
  });
});
