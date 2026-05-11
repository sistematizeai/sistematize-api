import type { FastifyInstance } from 'fastify';
import { createClientSchema, updateClientSchema, clientParamsSchema, listClientsQuerySchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';

export async function clientRoutes(app: FastifyInstance) {
  app.get('/api/clients', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listClientsQuerySchema,
  }, listHandler);

  app.get('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: clientParamsSchema,
  }, getHandler);

  app.post('/api/clients', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: createClientSchema,
  }, createHandler);

  app.put('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateClientSchema,
  }, updateHandler);

  app.delete('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: clientParamsSchema,
  }, deleteHandler);
}
