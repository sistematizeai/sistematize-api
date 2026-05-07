import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';
import { loadEnv } from '../config/env.js';

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
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token nao fornecido');
    }

    const token = authHeader.substring(7);
    try {
      const secret = process.env.SUPABASE_JWT_SECRET || loadEnv().SUPABASE_JWT_SECRET;
      const decoded = jwt.verify(token, secret) as {
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
