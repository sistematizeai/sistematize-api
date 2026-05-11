import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../utils/errors.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { verifyTOTPToken } from '../utils/totp.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireBusinessId: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
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

  app.decorate('requireBusinessId', async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user?.business_id) {
      throw new ForbiddenError('Esta acao requer vinculo com uma empresa');
    }
  });

  app.decorate('require2FA', async function (request: FastifyRequest, reply: FastifyReply) {
    const totpCode = (request.headers['x-totp-code'] as string) || '';
    if (!totpCode) {
      throw new ForbiddenError('Codigo 2FA obrigatorio para esta acao');
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', request.user.sub)
      .single();

    if (!profile?.totp_secret || !verifyTOTPToken(totpCode, profile.totp_secret)) {
      throw new ForbiddenError('Codigo 2FA invalido');
    }
  });
}

export const rbacPlugin = fp(rbacPluginFn, { name: 'rbac', dependencies: ['auth'] });
