import { describe, expect, it } from 'vitest';
import { buildAuthCookieOptions, sanitizeAuthResponse } from '../../src/utils/auth-session.js';

describe('auth session helpers', () => {
  it('uses HttpOnly secure cross-site cookies in production', () => {
    const options = buildAuthCookieOptions('production');
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('none');
    expect(options.path).toBe('/');
  });

  it('keeps local development cookies compatible with http localhost', () => {
    const options = buildAuthCookieOptions('development');
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe('lax');
  });

  it('removes raw JWT from auth responses after session cookie is set', () => {
    const response = sanitizeAuthResponse({ token: 'raw-jwt', user: { id: 'u1' } });
    expect(response).toEqual({ user: { id: 'u1' }, authenticated: true });
    expect('token' in response).toBe(false);
  });
});
