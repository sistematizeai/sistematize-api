import type { FastifyRequest, FastifyReply } from 'fastify';
import * as comboService from './service.js';

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const combos = await comboService.listCombos(request.user.business_id!);
  return reply.send(combos);
}

export async function getHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const combo = await comboService.getCombo(request.params.id, request.user.business_id!);
  return reply.send(combo);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { name: string; description?: string; price?: number; discount_percent?: number; duration_minutes?: number; is_active?: boolean; sort_order?: number; service_ids?: string[] } }>,
  reply: FastifyReply
) {
  const combo = await comboService.createCombo(request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'combo',
    entity_id: combo.id,
    new_data: combo,
  });
  return reply.status(201).send(combo);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; description?: string; price?: number; discount_percent?: number; duration_minutes?: number; is_active?: boolean; sort_order?: number; service_ids?: string[] } }>,
  reply: FastifyReply
) {
  const oldCombo = await comboService.getCombo(request.params.id, request.user.business_id!);
  const combo = await comboService.updateCombo(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'combo',
    entity_id: combo.id,
    old_data: oldCombo,
    new_data: combo,
  });
  return reply.send(combo);
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

  const combo = await comboService.uploadComboImage(
    request.params.id,
    request.user.business_id!,
    buffer,
    file.mimetype
  );
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'combo',
    entity_id: request.params.id,
    new_data: { image_url: combo.image_url },
  });
  return reply.send(combo);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await comboService.deleteCombo(request.params.id, request.user.business_id!);
  await request.server.audit(request, {
    action: 'delete',
    entity_type: 'combo',
    entity_id: request.params.id,
  });
  return reply.status(204).send();
}
