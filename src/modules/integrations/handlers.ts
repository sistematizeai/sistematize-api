import type { FastifyRequest, FastifyReply } from 'fastify';
import { connectAsaas, getAsaasStatus, testAsaasConnection, disconnectAsaas, recreateWebhook } from './service.js';

export async function connectHandler(
  request: FastifyRequest<{ Body: { apiKey: string; environment: 'sandbox' | 'production' } }>,
  reply: FastifyReply,
) {
  const { apiKey, environment } = request.body;
  const businessId = request.user.business_id!;

  const result = await connectAsaas(businessId, apiKey, environment);

  await request.server.audit(request, {
    action: 'asaas.connected',
    entity_type: 'asaas_connection',
    entity_id: result.id,
  });

  return reply.status(201).send(result);
}

export async function statusHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const status = await getAsaasStatus(businessId);
  return reply.send(status);
}

export async function testHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const result = await testAsaasConnection(businessId);
  return reply.send(result);
}

export async function disconnectHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  await disconnectAsaas(businessId);

  await request.server.audit(request, {
    action: 'asaas.disconnected',
    entity_type: 'asaas_connection',
  });

  return reply.send({ success: true });
}

export async function recreateWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const result = await recreateWebhook(businessId);

  await request.server.audit(request, {
    action: 'asaas.webhook_created',
    entity_type: 'asaas_connection',
  });

  return reply.send(result);
}
