import type { FastifyRequest, FastifyReply } from 'fastify';
import * as paymentService from './service.js';

export async function createCustomerHandler(
  request: FastifyRequest<{ Body: { clientId: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const asaasCustomerId = await paymentService.ensureAsaasCustomer(businessId, request.body.clientId, request.user.sub);

  await request.server.audit(request, {
    action: 'asaas.customer_created',
    entity_type: 'client',
    entity_id: request.body.clientId,
  });

  return reply.status(201).send({ asaasCustomerId });
}

export async function createPaymentHandler(
  request: FastifyRequest<{
    Body: {
      clientId: string;
      appointmentId?: string;
      value: number;
      dueDate: string;
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
      description?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const payment = await paymentService.createPayment(businessId, request.body, request.user.sub);

  await request.server.audit(request, {
    action: 'payment.created',
    entity_type: 'asaas_payment',
    entity_id: payment.id,
  });

  return reply.status(201).send(payment);
}

export async function listPaymentsHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      billing_type?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await paymentService.listPayments(businessId, request.query);
  return reply.send(result);
}

export async function getPaymentHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const payment = await paymentService.getPayment(request.params.id, businessId);
  return reply.send(payment);
}

export async function cancelPaymentHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await paymentService.cancelPayment(request.params.id, businessId);

  await request.server.audit(request, {
    action: 'payment.cancelled',
    entity_type: 'asaas_payment',
    entity_id: request.params.id,
  });

  return reply.send(result);
}

export async function summaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const summary = await paymentService.getPaymentsSummary(businessId);
  return reply.send(summary);
}
