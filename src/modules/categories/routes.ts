import type { FastifyInstance } from 'fastify';
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from './schemas.js';
import { listHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/api/categories', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, routeHandler(listHandler));

  app.post('/api/categories', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createCategorySchema,
  }, routeHandler(createHandler));

  app.put('/api/categories/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCategorySchema,
  }, routeHandler(updateHandler));

  app.delete('/api/categories/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: categoryParamsSchema,
  }, routeHandler(deleteHandler));
}
