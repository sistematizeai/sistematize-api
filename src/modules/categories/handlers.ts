import type { FastifyRequest, FastifyReply } from 'fastify';
import * as categoryService from './service.js';

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const categories = await categoryService.listCategories(request.user.business_id!);
  return reply.send(categories);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; color?: string; icon?: string; description?: string; sort_order?: number } }>,
  reply: FastifyReply
) {
  const category = await categoryService.createCategory(request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'category',
    entity_id: category.id,
    new_data: category,
  });
  return reply.status(201).send(category);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; color?: string; icon?: string; description?: string; sort_order?: number; is_active?: boolean } }>,
  reply: FastifyReply
) {
  const category = await categoryService.updateCategory(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'category',
    entity_id: category.id,
    new_data: category,
  });
  return reply.send(category);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await categoryService.deleteCategory(request.params.id, request.user.business_id!);
  await request.server.audit(request, {
    action: 'delete',
    entity_type: 'category',
    entity_id: request.params.id,
  });
  return reply.status(204).send();
}
