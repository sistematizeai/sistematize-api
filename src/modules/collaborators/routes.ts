import type { FastifyInstance } from 'fastify';
import { createCollaboratorSchema, updateCollaboratorSchema, collaboratorParamsSchema, updateCollaboratorServicesSchema, updateCollaboratorScheduleSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, updateServicesHandler, getScheduleHandler, updateScheduleHandler } from './handlers.js';

export async function collaboratorRoutes(app: FastifyInstance) {
  app.get('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, listHandler);

  app.get('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, getHandler);

  app.post('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createCollaboratorSchema,
  }, createHandler);

  app.put('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorSchema,
  }, updateHandler);

  app.delete('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, deleteHandler);

  app.put('/api/collaborators/:id/services', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorServicesSchema,
  }, updateServicesHandler);

  app.get('/api/collaborators/:id/schedule', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, getScheduleHandler);

  app.put('/api/collaborators/:id/schedule', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorScheduleSchema,
  }, updateScheduleHandler);
}
