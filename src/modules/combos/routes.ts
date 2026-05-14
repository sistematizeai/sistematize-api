import type { FastifyInstance } from 'fastify';
import { createComboSchema, updateComboSchema, comboParamsSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, uploadImageHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function comboRoutes(app: FastifyInstance) {
  app.get('/api/combos', {
    preHandler: [app.authenticate, app.requireBusinessId],
  }, routeHandler(listHandler));

  app.get('/api/combos/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: comboParamsSchema,
  }, routeHandler(getHandler));

  app.post('/api/combos', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createComboSchema,
  }, routeHandler(createHandler));

  app.patch('/api/combos/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateComboSchema,
  }, routeHandler(updateHandler));

  app.post('/api/combos/:id/image', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: comboParamsSchema,
  }, routeHandler(uploadImageHandler));

  app.delete('/api/combos/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: comboParamsSchema,
  }, routeHandler(deleteHandler));
}
