import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function planRoutes(app: FastifyInstance) {
  app.get('/api/plans', { preHandler: [app.authenticate] }, routeHandler(handlers.listHandler));

  app.post('/api/plans', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.createPlanSchema,
  }, routeHandler(handlers.createHandler));

  app.put('/api/plans/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.updatePlanSchema,
  }, routeHandler(handlers.updateHandler));

  app.delete('/api/plans/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
  }, routeHandler(handlers.deleteHandler));
}
