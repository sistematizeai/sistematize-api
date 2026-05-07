import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profiles/me', { preHandler: [app.authenticate] }, handlers.getMeHandler);
  app.put('/api/profiles/me', {
    preHandler: [app.authenticate],
    schema: schemas.updateProfileSchema,
  }, handlers.updateMeHandler);

  app.get('/api/profiles', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, handlers.listHandler);
  app.put('/api/profiles/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.adminUpdateProfileSchema,
  }, handlers.adminUpdateHandler);
}
