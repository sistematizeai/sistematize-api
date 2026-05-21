import { describe, expect, it } from 'vitest';

describe('Cron security helpers', () => {
  it('requires CRON_SECRET readiness in production', async () => {
    const { getCronReadiness } = await import('../../src/modules/webhooks/routes.js');

    expect(getCronReadiness({ NODE_ENV: 'production' })).toEqual({
      ready: false,
      reason: 'CRON_SECRET ausente em producao',
    });
    expect(getCronReadiness({ NODE_ENV: 'production', CRON_SECRET: 'secret' })).toEqual({ ready: true });
  });

  it('authorizes cron calls only with configured secret', async () => {
    const { isCronAuthorized } = await import('../../src/modules/webhooks/routes.js');

    expect(isCronAuthorized('secret', { CRON_SECRET: 'secret' })).toBe(true);
    expect(isCronAuthorized('wrong', { CRON_SECRET: 'secret' })).toBe(false);
    expect(isCronAuthorized(undefined, { CRON_SECRET: 'secret' })).toBe(false);
  });
});
