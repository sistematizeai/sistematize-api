import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';
import { ForbiddenError } from '../../utils/errors.js';
import { verifyTOTPToken } from '../../utils/totp.js';
import { getSupabaseAdmin } from '../../config/supabase.js';

export async function getMyBusinessHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.business_id) throw new ForbiddenError('Sem negocio vinculado');
  const data = await service.getMyBusiness(request.user.business_id);
  return reply.send(data);
}

export async function updateMyBusinessHandler(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  if (!request.user.business_id) throw new ForbiddenError('Sem negocio vinculado');
  const old = await service.getMyBusiness(request.user.business_id);
  const data = await service.updateMyBusiness(request.user.business_id, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'business', entity_id: request.user.business_id,
    old_data: old as Record<string, unknown>, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function listHandler(
  request: FastifyRequest<{ Querystring: { page?: string; limit?: string; search?: string; status?: string } }>,
  reply: FastifyReply,
) {
  const page = parseInt(request.query.page || '1', 10);
  const limit = parseInt(request.query.limit || '20', 10);
  return reply.send(await service.listBusinesses(page, limit, request.query.search, request.query.status));
}

export async function getByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  return reply.send(await service.getBusinessById(request.params.id));
}

export async function adminUpdateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const old = await service.getBusinessById(request.params.id);
  const data = await service.adminUpdateBusiness(request.params.id, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'business', entity_id: request.params.id,
    old_data: old as Record<string, unknown>, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function updateStatusHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
  reply: FastifyReply,
) {
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

  const old = await service.getBusinessById(request.params.id);
  const data = await service.updateBusinessStatus(request.params.id, request.body.status);
  await request.server.audit(request, {
    action: 'update', entity_type: 'business', entity_id: request.params.id,
    old_data: { subscription_status: (old as any).subscription_status },
    new_data: { subscription_status: request.body.status },
  });
  return reply.send(data);
}

export async function uploadLogoHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.business_id) throw new ForbiddenError('Sem negocio vinculado');
  const file = await request.file();
  if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return reply.status(400).send({ error: 'Tipo de arquivo nao suportado. Use JPG, PNG ou WebP.' });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of file.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  if (buffer.length > 2 * 1024 * 1024) {
    return reply.status(400).send({ error: 'Arquivo muito grande. Maximo 2MB.' });
  }

  const data = await service.uploadBusinessImage(request.user.business_id, 'logo_url', buffer, file.mimetype);
  return reply.send(data);
}

export async function uploadCoverHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.business_id) throw new ForbiddenError('Sem negocio vinculado');
  const file = await request.file();
  if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return reply.status(400).send({ error: 'Tipo de arquivo nao suportado. Use JPG, PNG ou WebP.' });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of file.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  if (buffer.length > 5 * 1024 * 1024) {
    return reply.status(400).send({ error: 'Arquivo muito grande. Maximo 5MB.' });
  }

  const data = await service.uploadBusinessImage(request.user.business_id, 'cover_image_url', buffer, file.mimetype);
  return reply.send(data);
}

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const data = await service.getBusinessStats();
  return reply.send(data);
}

export async function blockExpiredHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await service.blockExpiredTrials();
  await request.server.audit(request, {
    action: 'block',
    entity_type: 'business',
    new_data: result,
  });
  return reply.send(result);
}
