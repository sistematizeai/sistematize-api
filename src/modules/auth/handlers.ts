import { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './service.js';

export async function registerHandler(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await authService.registerUser(request.body as unknown as Parameters<typeof authService.registerUser>[0]);
  return reply.status(201).send(result);
}

export async function resendConfirmationHandler(
  request: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.resendConfirmation(request.body.email);
  return reply.send(result);
}

export async function confirmEmailHandler(
  request: FastifyRequest<{ Body: { token: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.confirmEmail(request.body.token);
  return reply.send(result);
}

export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.loginUser(request.body.email, request.body.password);
  if (result.user?.id) {
    await request.server.audit(request, {
      action: 'login',
      entity_type: 'profile',
      entity_id: result.user.id,
    });
  }
  return reply.send(result);
}

export async function verify2FAHandler(
  request: FastifyRequest<{ Body: { temp_token: string; totp_code: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.verify2FA(request.body.temp_token, request.body.totp_code);
  return reply.send(result);
}

export async function setup2FAHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await authService.setup2FA(request.user.sub);
  return reply.send(result);
}

export async function confirm2FAHandler(
  request: FastifyRequest<{ Body: { totp_code: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.confirm2FA(request.user.sub, request.body.totp_code);
  await request.server.audit(request, {
    action: '2fa_enable',
    entity_type: 'profile',
    entity_id: request.user.sub,
  });
  return reply.send(result);
}

export async function completeRegistrationHandler(
  request: FastifyRequest<{ Body: { document: string; business_name: string; full_name?: string } }>,
  reply: FastifyReply,
) {
  const result = await authService.completeGoogleRegistration({
    userId: request.user.sub,
    email: request.user.email || '',
    document: request.body.document,
    business_name: request.body.business_name,
    full_name: request.body.full_name,
  });
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'profile',
    entity_id: result.user.id,
    new_data: { business_name: request.body.business_name },
  });
  return reply.status(201).send(result);
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({ message: 'Logout realizado com sucesso' });
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const { sub, email } = request.user;
  const { getSupabaseAdmin } = await import('../../config/supabase.js');
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', sub)
    .single();

  if (!profile) {
    return reply.status(401).send({ error: 'Perfil nao encontrado' });
  }

  const jwtModule = await import('jsonwebtoken');
  const { loadEnv } = await import('../../config/env.js');
  const env = loadEnv();
  const token = jwtModule.default.sign(
    { sub, role: profile.role, business_id: profile.business_id, email },
    env.SUPABASE_JWT_SECRET,
    { expiresIn: '7d' },
  );
  return reply.send({ token });
}
