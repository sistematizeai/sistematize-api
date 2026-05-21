import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const data = await service.getMyProfile(request.user.sub);
  return reply.send(data);
}

export async function updateMeHandler(
  request: FastifyRequest<{ Body: { full_name?: string; phone?: string; avatar_url?: string } }>,
  reply: FastifyReply,
) {
  const old = await service.getMyProfile(request.user.sub);
  const data = await service.updateMyProfile(request.user.sub, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'profile', entity_id: request.user.sub,
    old_data: old as Record<string, unknown>, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function listHandler(
  request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const page = parseInt(request.query.page || '1', 10);
  const limit = parseInt(request.query.limit || '20', 10);
  const data = await service.listProfiles(page, limit);
  return reply.send(data);
}

export async function createInternalUserHandler(
  request: FastifyRequest<{ Body: service.CreateInternalUserInput }>,
  reply: FastifyReply,
) {
  const data = await service.createInternalUser(request.body);
  await request.server.audit(request, {
    action: 'internal_user.create',
    entity_type: 'profile',
    entity_id: data.id,
    new_data: { role: data.role, permissions: data.permissions },
  });
  return reply.status(201).send(data);
}

export async function getDetailHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  return reply.send(await service.getProfileDetail(request.params.id));
}

export async function adminUpdateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const old = await service.getMyProfile(request.params.id);
  const data = await service.adminUpdateProfile(request.params.id, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'profile', entity_id: request.params.id,
    old_data: old as Record<string, unknown>, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function updateStatusHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { is_active: boolean } }>,
  reply: FastifyReply,
) {
  const old = await service.getMyProfile(request.params.id);
  const data = await service.updateProfileStatus(request.params.id, request.body.is_active);
  await request.server.audit(request, {
    action: request.body.is_active ? 'internal_user.activate' : 'internal_user.deactivate',
    entity_type: 'profile',
    entity_id: request.params.id,
    old_data: { is_active: (old as any).is_active },
    new_data: { is_active: request.body.is_active },
  });
  return reply.send(data);
}
