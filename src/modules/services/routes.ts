import type { FastifyInstance } from 'fastify';
import { createServiceSchema, updateServiceSchema, serviceParamsSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';

export async function serviceRoutes(app: FastifyInstance) {
  app.get('/api/services', {
    preHandler: [app.authenticate],
  }, listHandler);

  app.get('/api/services/:id', {
    preHandler: [app.authenticate],
    schema: serviceParamsSchema,
  }, getHandler);

  app.post('/api/services', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: createServiceSchema,
  }, createHandler);

  app.put('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: updateServiceSchema,
  }, updateHandler);

  app.delete('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: serviceParamsSchema,
  }, deleteHandler);
}
