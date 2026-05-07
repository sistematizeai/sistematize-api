import type { FastifyRequest, FastifyReply } from 'fastify';
import * as clientService from './service.js';

export async function listHandler(
  request: FastifyRequest<{ Querystring: { search?: string } }>,
  reply: FastifyReply
) {
  const clients = await clientService.listClients(request.user.business_id!, request.query.search);
  return reply.send(clients);
}

export async function getHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const client = await clientService.getClient(request.params.id, request.user.business_id!);
  return reply.send(client);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; phone?: string; email?: string; birth_date?: string; source?: string; notes?: string } }>,
  reply: FastifyReply
) {
  const client = await clientService.createClient(request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'client',
    entity_id: client.id,
    new_data: client,
  });
  return reply.status(201).send(client);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; phone?: string; email?: string; birth_date?: string; source?: string; notes?: string; is_active?: boolean } }>,
  reply: FastifyReply
) {
  const client = await clientService.updateClient(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'client',
    entity_id: client.id,
    new_data: client,
  });
  return reply.send(client);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await clientService.deleteClient(request.params.id, request.user.business_id!);
  return reply.status(204).send();
}
