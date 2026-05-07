import type { FastifyInstance } from 'fastify';
import { createCollaboratorSchema, updateCollaboratorSchema, collaboratorParamsSchema, updateCollaboratorServicesSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, updateServicesHandler } from './handlers.js';

export async function collaboratorRoutes(app: FastifyInstance) {
  app.get('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
  }, listHandler);

  app.get('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: collaboratorParamsSchema,
  }, getHandler);

  app.post('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: createCollaboratorSchema,
  }, createHandler);

  app.put('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: updateCollaboratorSchema,
  }, updateHandler);

  app.delete('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: collaboratorParamsSchema,
  }, deleteHandler);

  app.put('/api/collaborators/:id/services', {
    preHandler: [app.authenticate, app.requireRole(['owner'])],
    schema: updateCollaboratorServicesSchema,
  }, updateServicesHandler);
}
