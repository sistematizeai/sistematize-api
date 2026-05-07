import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function planRoutes(app: FastifyInstance) {
  app.get('/api/plans', { preHandler: [app.authenticate] }, handlers.listHandler);

  app.post('/api/plans', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.createPlanSchema,
  }, handlers.createHandler);

  app.put('/api/plans/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.updatePlanSchema,
  }, handlers.updateHandler);

  app.delete('/api/plans/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
  }, handlers.deleteHandler);
}
