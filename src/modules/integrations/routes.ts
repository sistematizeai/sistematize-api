import type { FastifyInstance } from 'fastify';
import { connectAsaasSchema } from './schemas.js';
import { connectHandler, statusHandler, testHandler, disconnectHandler, recreateWebhookHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function integrationRoutes(app: FastifyInstance) {
  app.post('/api/integrations/asaas/connect', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: connectAsaasSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, routeHandler(connectHandler));

  app.get('/api/integrations/asaas/status', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, routeHandler(statusHandler));

  app.post('/api/integrations/asaas/test', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, routeHandler(testHandler));

  app.delete('/api/integrations/asaas/disconnect', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, routeHandler(disconnectHandler));

  app.post('/api/integrations/asaas/recreate-webhook', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, routeHandler(recreateWebhookHandler));
}
