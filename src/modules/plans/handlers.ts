import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';
import { ForbiddenError } from '../../utils/errors.js';
import { verifyTOTPToken } from '../../utils/totp.js';
import { getSupabaseAdmin } from '../../config/supabase.js';

async function verify2FAFromHeader(request: FastifyRequest) {
  const totpCode = request.headers['x-totp-code'] as string;
  if (!totpCode) throw new ForbiddenError('Codigo 2FA obrigatorio');

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('profiles')
    .select('totp_secret')
    .eq('id', request.user.sub)
    .single();

  if (!profile?.totp_secret || !verifyTOTPToken(totpCode, profile.totp_secret)) {
    throw new ForbiddenError('Codigo 2FA invalido');
  }
}

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const isAdmin = ['master_admin', 'sub_admin'].includes(request.user.role);
  return reply.send(await service.listPlans(isAdmin));
}

export async function createHandler(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  await verify2FAFromHeader(request);
  const data = await service.createPlan(request.body);
  await request.server.audit(request, {
    action: 'create', entity_type: 'plan', entity_id: data.id, new_data: data as Record<string, unknown>,
  });
  return reply.status(201).send(data);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  await verify2FAFromHeader(request);
  const data = await service.updatePlan(request.params.id, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'plan', entity_id: request.params.id, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await verify2FAFromHeader(request);
  await service.deactivatePlan(request.params.id);
  await request.server.audit(request, {
    action: 'delete', entity_type: 'plan', entity_id: request.params.id,
  });
  return reply.status(204).send();
}
