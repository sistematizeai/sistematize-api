import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profiles/me', { preHandler: [app.authenticate] }, routeHandler(handlers.getMeHandler));
  app.put('/api/profiles/me', {
    preHandler: [app.authenticate],
    schema: schemas.updateProfileSchema,
  }, routeHandler(handlers.updateMeHandler));

  app.get('/api/profiles', {
    preHandler: [app.authenticate, app.requirePermission('users.read')],
  }, routeHandler(handlers.listHandler));
  app.post('/api/profiles/internal', {
    preHandler: [app.authenticate, app.requirePermission('users.write'), app.requireSensitiveConfirmation],
    schema: schemas.createInternalUserSchema,
  }, routeHandler(handlers.createInternalUserHandler));
  app.get('/api/profiles/:id/detail', {
    preHandler: [app.authenticate, app.requirePermission('users.read')],
    schema: schemas.profileParamsSchema,
  }, routeHandler(handlers.getDetailHandler));
  app.put('/api/profiles/:id', {
    preHandler: [app.authenticate, app.requirePermission('users.write'), app.requireSensitiveConfirmation],
    schema: schemas.adminUpdateProfileSchema,
  }, routeHandler(handlers.adminUpdateHandler));
  app.patch('/api/profiles/:id/status', {
    preHandler: [app.authenticate, app.requirePermission('users.write'), app.requireSensitiveConfirmation],
    schema: schemas.updateProfileStatusSchema,
  }, routeHandler(handlers.updateStatusHandler));
}
