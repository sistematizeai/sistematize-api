import type { FastifyInstance } from 'fastify';
import { statsHandler, upcomingHandler, collaboratorPerformanceHandler } from './handlers.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard/stats', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
  }, statsHandler);

  app.get('/api/dashboard/upcoming', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
  }, upcomingHandler);

  app.get('/api/dashboard/collaborator-performance', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
  }, collaboratorPerformanceHandler);
}
