import type { FastifyInstance } from 'fastify';
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from './schemas.js';
import { listHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/api/categories', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, listHandler);

  app.post('/api/categories', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createCategorySchema,
  }, createHandler);

  app.put('/api/categories/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCategorySchema,
  }, updateHandler);

  app.delete('/api/categories/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: categoryParamsSchema,
  }, deleteHandler);
}
