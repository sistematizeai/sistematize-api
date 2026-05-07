import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';

export async function listHandler(
  request: FastifyRequest<{ Querystring: { page?: string; limit?: string; entity_type?: string; action?: string } }>,
  reply: FastifyReply,
) {
  const data = await service.listAuditLogs({
    page: parseInt(request.query.page || '1', 10),
    limit: parseInt(request.query.limit || '50', 10),
    entity_type: request.query.entity_type,
    action: request.query.action,
  });
  return reply.send(data);
}
