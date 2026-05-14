import type { FastifyInstance } from 'fastify';
import { createClientSchema, updateClientSchema, clientParamsSchema, listClientsQuerySchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function clientRoutes(app: FastifyInstance) {
  app.get('/api/clients', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listClientsQuerySchema,
  }, routeHandler(listHandler));

  app.get('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: clientParamsSchema,
  }, routeHandler(getHandler));

  app.post('/api/clients', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: createClientSchema,
  }, routeHandler(createHandler));

  app.put('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateClientSchema,
  }, routeHandler(updateHandler));

  app.delete('/api/clients/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: clientParamsSchema,
  }, routeHandler(deleteHandler));
}
