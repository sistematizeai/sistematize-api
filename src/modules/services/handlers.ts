import type { FastifyRequest, FastifyReply } from 'fastify';
import * as serviceService from './service.js';

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const services = await serviceService.listServices(request.user.business_id!);
  return reply.send(services);
}

export async function getHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const service = await serviceService.getService(request.params.id, request.user.business_id!);
  return reply.send(service);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; category_id: string; description?: string; price?: number; price_type?: string; duration_minutes?: number; is_active?: boolean; sort_order?: number } }>,
  reply: FastifyReply
) {
  const service = await serviceService.createService(request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'service',
    entity_id: service.id,
    new_data: service,
  });
  return reply.status(201).send(service);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; category_id?: string; description?: string; price?: number; price_type?: string; duration_minutes?: number; is_active?: boolean; sort_order?: number } }>,
  reply: FastifyReply
) {
  const service = await serviceService.updateService(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'service',
    entity_id: service.id,
    new_data: service,
  });
  return reply.send(service);
}

export async function uploadImageHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const file = await request.file();
  if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return reply.status(400).send({ error: 'Tipo de arquivo nao suportado. Use JPG, PNG ou WebP.' });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of file.file) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  if (buffer.length > 5 * 1024 * 1024) {
    return reply.status(400).send({ error: 'Arquivo muito grande. Maximo 5MB.' });
  }

  const service = await serviceService.uploadServiceImage(
    request.params.id,
    request.user.business_id!,
    buffer,
    file.mimetype
  );
  return reply.send(service);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await serviceService.deleteService(request.params.id, request.user.business_id!);
  await request.server.audit(request, {
    action: 'delete',
    entity_type: 'service',
    entity_id: request.params.id,
  });
  return reply.status(204).send();
}
