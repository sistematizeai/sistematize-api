import type { FastifyInstance } from 'fastify';
import { createClientSchema, updateClientSchema, clientParamsSchema, listClientsQuerySchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';

export async function clientRoutes(app: FastifyInstance) {
  app.get('/api/clients', {
    preHandler: [app.authenticate],
    schema: listClientsQuerySchema,
  }, listHandler);

  app.get('/api/clients/:id', {
    preHandler: [app.authenticate],
    schema: clientParamsSchema,
  }, getHandler);

  app.post('/api/clients', {
    preHandler: [app.authenticate],
    schema: createClientSchema,
  }, createHandler);

  app.put('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: updateClientSchema,
  }, updateHandler);

  app.delete('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: clientParamsSchema,
  }, deleteHandler);
}
