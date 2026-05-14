import type { FastifyInstance } from 'fastify';
import { createServiceSchema, updateServiceSchema, serviceParamsSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, uploadImageHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function serviceRoutes(app: FastifyInstance) {
  app.get('/api/services', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, routeHandler(listHandler));

  app.get('/api/services/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: serviceParamsSchema,
  }, routeHandler(getHandler));

  app.post('/api/services', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createServiceSchema,
  }, routeHandler(createHandler));

  app.put('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateServiceSchema,
  }, routeHandler(updateHandler));

  app.post('/api/services/:id/image', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, routeHandler(uploadImageHandler));

  app.delete('/api/services/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: serviceParamsSchema,
  }, routeHandler(deleteHandler));
}
