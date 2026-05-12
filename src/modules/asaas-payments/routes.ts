import type { FastifyInstance } from 'fastify';
import { createAsaasCustomerSchema, createPaymentSchema, listPaymentsQuerySchema, paymentParamsSchema } from './schemas.js';
import { createCustomerHandler, createPaymentHandler, listPaymentsHandler, getPaymentHandler, cancelPaymentHandler, summaryHandler } from './handlers.js';

export async function asaasPaymentRoutes(app: FastifyInstance) {
  app.post('/api/asaas/customers', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createAsaasCustomerSchema,
  }, createCustomerHandler);

  app.post('/api/asaas/payments', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createPaymentSchema,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, createPaymentHandler);

  app.get('/api/asaas/payments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listPaymentsQuerySchema,
  }, listPaymentsHandler);

  app.get('/api/asaas/payments/summary', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, summaryHandler);

  app.get('/api/asaas/payments/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: paymentParamsSchema,
  }, getPaymentHandler);

  app.post('/api/asaas/payments/:id/cancel', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: paymentParamsSchema,
  }, cancelPaymentHandler);
}
