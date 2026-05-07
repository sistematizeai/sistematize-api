import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../utils/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    require2FA: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function rbacPluginFn(app: FastifyInstance) {
  app.decorate('requireRole', function (roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user || !roles.includes(request.user.role)) {
        throw new ForbiddenError('Voce nao tem permissao para acessar este recurso');
      }
    };
  });

  app.decorate('require2FA', async function (request: FastifyRequest, reply: FastifyReply) {
    const totpCode = (request.headers['x-totp-code'] as string) || '';
    if (!totpCode) {
      throw new ForbiddenError('Codigo 2FA obrigatorio para esta acao');
    }
    (request as any).totpCode = totpCode;
  });
}

export const rbacPlugin = fp(rbacPluginFn, { name: 'rbac', dependencies: ['auth'] });
