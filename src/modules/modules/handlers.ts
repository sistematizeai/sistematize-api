import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await service.listModules());
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; slug: string; description?: string } }>,
  reply: FastifyReply,
) {
  const data = await service.createModule(request.body);
  await request.server.audit(request, {
    action: 'create', entity_type: 'module', entity_id: data.id, new_data: data as Record<string, unknown>,
  });
  return reply.status(201).send(data);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const data = await service.updateModule(request.params.id, request.body);
  await request.server.audit(request, {
    action: 'update', entity_type: 'module', entity_id: request.params.id, new_data: data as Record<string, unknown>,
  });
  return reply.send(data);
}

export async function linkHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { module_id: string } }>,
  reply: FastifyReply,
) {
  const data = await service.linkModuleToPlan(request.params.id, request.body.module_id);
  await request.server.audit(request, {
    action: 'create', entity_type: 'plan_module',
    new_data: { plan_id: request.params.id, module_id: request.body.module_id },
  });
  return reply.status(201).send(data);
}

export async function unlinkHandler(
  request: FastifyRequest<{ Params: { id: string; moduleId: string } }>,
  reply: FastifyReply,
) {
  await service.unlinkModuleFromPlan(request.params.id, request.params.moduleId);
  await request.server.audit(request, {
    action: 'delete', entity_type: 'plan_module',
    old_data: { plan_id: request.params.id, module_id: request.params.moduleId },
  });
  return reply.status(204).send();
}

export async function userModuleOverrideHandler(
  request: FastifyRequest<{ Body: { profile_id: string; module_id: string; business_id: string; is_active?: boolean } }>,
  reply: FastifyReply,
) {
  const data = await service.createUserModuleOverride({
    ...request.body,
    granted_by: request.user.sub,
  });
  await request.server.audit(request, {
    action: 'create', entity_type: 'user_module', new_data: data as Record<string, unknown>,
  });
  return reply.status(201).send(data);
}
