import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { loadEnv } from '../config/env.js';
import { AUTH_COOKIE_NAME } from '../utils/auth-session.js';

const CSRF_HEADER_NAME = 'x-sistematize-csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === AUTH_COOKIE_NAME) return decodeURIComponent(rawValue.join('='));
  }
  return null;
}

function isCookieCsrfProtected(request: FastifyRequest, usedCookieAuth: boolean): boolean {
  if (!usedCookieAuth) return true;
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const csrfHeader = request.headers[CSRF_HEADER_NAME];
  return typeof csrfHeader === 'string' && csrfHeader.length > 0;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      sub: string;
      role: string;
      business_id: string | null;
      email?: string;
    };
  }
}

async function authPluginFn(app: FastifyInstance) {
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = bearerToken ? null : parseCookieToken(request.headers.cookie);
    const token = bearerToken || cookieToken;

    if (!token) {
      throw new UnauthorizedError('Token nao fornecido');
    }

    if (!isCookieCsrfProtected(request, Boolean(cookieToken))) {
      throw new ForbiddenError('Cabecalho CSRF obrigatorio');
    }

    try {
      const secret = process.env.SUPABASE_JWT_SECRET || loadEnv().SUPABASE_JWT_SECRET;
      const decoded = jwt.verify(token, secret, { issuer: 'sistematize-api', audience: 'sistematize' }) as {
        sub: string;
        role: string;
        business_id: string | null;
        email?: string;
      };
      request.user = decoded;
    } catch {
      throw new UnauthorizedError('Token invalido ou expirado');
    }
  });
}

export const authPlugin = fp(authPluginFn, { name: 'auth' });
