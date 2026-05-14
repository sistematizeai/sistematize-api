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
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, routeHandler(handlers.listHandler));
  app.put('/api/profiles/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.adminUpdateProfileSchema,
  }, routeHandler(handlers.adminUpdateHandler));
}
