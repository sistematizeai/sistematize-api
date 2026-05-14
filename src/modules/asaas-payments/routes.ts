import type { FastifyInstance } from 'fastify';
import { createAsaasCustomerSchema, createPaymentSchema, listPaymentsQuerySchema, paymentParamsSchema } from './schemas.js';
import { createCustomerHandler, createPaymentHandler, listPaymentsHandler, getPaymentHandler, cancelPaymentHandler, summaryHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function asaasPaymentRoutes(app: FastifyInstance) {
  app.post('/api/asaas/customers', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createAsaasCustomerSchema,
  }, routeHandler(createCustomerHandler));

  app.post('/api/asaas/payments', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createPaymentSchema,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, routeHandler(createPaymentHandler));

  app.get('/api/asaas/payments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listPaymentsQuerySchema,
  }, routeHandler(listPaymentsHandler));

  app.get('/api/asaas/payments/summary', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, routeHandler(summaryHandler));

  app.get('/api/asaas/payments/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: paymentParamsSchema,
  }, routeHandler(getPaymentHandler));

  app.post('/api/asaas/payments/:id/cancel', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: paymentParamsSchema,
  }, routeHandler(cancelPaymentHandler));
}
