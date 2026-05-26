import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';

export async function adminSubscriptionsHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { status, page, limit } = request.query;
  const result = await service.adminListSubscriptions({
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}

export async function adminRevenueHandler(_request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.adminGetRevenueStats();
  reply.send(stats);
}

export async function plansHandler(_request: FastifyRequest, reply: FastifyReply) {
  const plans = await service.getAvailablePlans();
  reply.send(plans);
}

export async function subscribeHandler(
  request: FastifyRequest<{ Body: { plan_id: string; billing_cycle: 'monthly' | 'yearly'; billing_type?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { plan_id, billing_cycle, billing_type } = request.body;
  const result = await service.createSubscription(businessId, plan_id, billing_cycle, billing_type as any);
  reply.status(201).send(result);
}

export async function currentHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const sub = await service.getActiveSubscription(businessId);
  reply.send(sub || { active: false });
}

export async function upgradeHandler(
  request: FastifyRequest<{ Body: { plan_id: string; billing_cycle?: 'monthly' | 'yearly'; billing_type?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { plan_id, billing_cycle, billing_type } = request.body;
  const result = await service.upgradeSubscription(businessId, plan_id, billing_cycle, billing_type as any);
  reply.send(result);
}

export async function cancelHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const result = await service.cancelSubscription(businessId);
  reply.send(result);
}

export async function invoicesHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { status, page, limit } = request.query;
  const result = await service.listInvoices(businessId, {
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}
