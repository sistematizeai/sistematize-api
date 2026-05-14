import type { FastifyInstance } from 'fastify';
import { createCollaboratorSchema, updateCollaboratorSchema, collaboratorParamsSchema, updateCollaboratorServicesSchema, updateCollaboratorScheduleSchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler, updateServicesHandler, getScheduleHandler, updateScheduleHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function collaboratorRoutes(app: FastifyInstance) {
  app.get('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
  }, routeHandler(listHandler));

  app.get('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, routeHandler(getHandler));

  app.post('/api/collaborators', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createCollaboratorSchema,
  }, routeHandler(createHandler));

  app.put('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorSchema,
  }, routeHandler(updateHandler));

  app.delete('/api/collaborators/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, routeHandler(deleteHandler));

  app.put('/api/collaborators/:id/services', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorServicesSchema,
  }, routeHandler(updateServicesHandler));

  app.get('/api/collaborators/:id/schedule', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: collaboratorParamsSchema,
  }, routeHandler(getScheduleHandler));

  app.put('/api/collaborators/:id/schedule', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: updateCollaboratorScheduleSchema,
  }, routeHandler(updateScheduleHandler));
}
