import type { FastifyInstance } from 'fastify';
import { createServiceSchema, updateServiceSchema, serviceParamsSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, uploadImageHandler } from './handlers.js';

export async function serviceRoutes(app: FastifyInstance) {
  app.get('/api/services', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, listHandler);

  app.get('/api/services/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: serviceParamsSchema,
  }, getHandler);

  app.post('/api/services', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createServiceSchema,
  }, createHandler);

  app.put('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateServiceSchema,
  }, updateHandler);

  app.post('/api/services/:id/image', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, uploadImageHandler);

  app.delete('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: serviceParamsSchema,
  }, deleteHandler);
}
