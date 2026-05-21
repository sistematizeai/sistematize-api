import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';

export const AUTH_COOKIE_NAME = 'sistematize_session';
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function buildAuthCookieOptions(nodeEnv: string): CookieSerializeOptions {
  const production = nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function setAuthSessionCookie(reply: FastifyReply, token: string, nodeEnv: string) {
  reply.setCookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions(nodeEnv));
}

export function clearAuthSessionCookie(reply: FastifyReply, nodeEnv: string) {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    ...buildAuthCookieOptions(nodeEnv),
    maxAge: 0,
  });
}

export function sanitizeAuthResponse<T extends { token?: string }>(result: T): Omit<T, 'token'> & { authenticated: true } {
  const { token: _token, ...rest } = result;
  return { ...rest, authenticated: true };
}
