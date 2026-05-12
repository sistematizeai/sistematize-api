import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function platformSubscriptionRoutes(app: FastifyInstance) {
  app.get('/api/subscription/plans', { preHandler: [app.authenticate] }, handlers.plansHandler);

  app.get('/api/subscription/current', { preHandler: [app.authenticate] }, handlers.currentHandler);

  app.post('/api/subscription/subscribe', {
    preHandler: [app.authenticate],
    schema: schemas.subscribeSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, handlers.subscribeHandler);

  app.put('/api/subscription/upgrade', {
    preHandler: [app.authenticate],
    schema: schemas.upgradeSchema,
  }, handlers.upgradeHandler);

  app.post('/api/subscription/cancel', {
    preHandler: [app.authenticate],
  }, handlers.cancelHandler);

  app.get('/api/subscription/invoices', {
    preHandler: [app.authenticate],
  }, handlers.invoicesHandler);

  // Admin-only endpoints
  app.get('/api/admin/subscriptions', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, handlers.adminSubscriptionsHandler);

  app.get('/api/admin/subscriptions/stats', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, handlers.adminRevenueHandler);
}
