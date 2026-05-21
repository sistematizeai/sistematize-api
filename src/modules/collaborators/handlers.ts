import type { FastifyRequest, FastifyReply } from 'fastify';
import * as collabService from './service.js';

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const collaborators = await collabService.listCollaborators(request.user.business_id!);
  return reply.send(collaborators);
}

export async function getHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const collaborator = await collabService.getCollaborator(request.params.id, request.user.business_id!);
  return reply.send(collaborator);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; phone?: string; email?: string; cpf?: string; birth_date?: string; address?: string; base_commission?: number; work_start?: string; work_end?: string; notes?: string; is_active?: boolean } }>,
  reply: FastifyReply
) {
  const collaborator = await collabService.createCollaborator(request.user.business_id!, request.body, request.user.sub);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'collaborator',
    entity_id: collaborator.id,
    new_data: collaborator,
  });
  return reply.status(201).send(collaborator);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; phone?: string; email?: string; cpf?: string; birth_date?: string; address?: string; base_commission?: number; work_start?: string; work_end?: string; notes?: string; is_active?: boolean } }>,
  reply: FastifyReply
) {
  const collaborator = await collabService.updateCollaborator(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'collaborator',
    entity_id: collaborator.id,
    new_data: collaborator,
  });
  return reply.send(collaborator);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await collabService.deleteCollaborator(request.params.id, request.user.business_id!);
  await request.server.audit(request, {
    action: 'delete',
    entity_type: 'collaborator',
    entity_id: request.params.id,
  });
  return reply.status(204).send();
}

export async function getScheduleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const schedule = await collabService.getCollaboratorSchedule(request.params.id, request.user.business_id!);
  return reply.send(schedule);
}

export async function updateScheduleHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { schedules: Array<{ day_of_week: number; is_working?: boolean; work_start?: string; work_end?: string; lunch_start?: string | null; lunch_end?: string | null }> } }>,
  reply: FastifyReply
) {
  const schedule = await collabService.updateCollaboratorSchedule(
    request.params.id,
    request.user.business_id!,
    request.body.schedules
  );
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'collaborator_schedule',
    entity_id: request.params.id,
    new_data: { schedules: schedule },
  });
  return reply.send(schedule);
}

export async function updateServicesHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { services: Array<{ service_id: string; commission?: number }> } }>,
  reply: FastifyReply
) {
  const result = await collabService.updateCollaboratorServices(
    request.params.id,
    request.user.business_id!,
    request.body.services
  );
  return reply.send(result);
}
