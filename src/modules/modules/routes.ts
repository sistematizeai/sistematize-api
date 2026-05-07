import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function moduleRoutes(app: FastifyInstance) {
  app.get('/api/modules', { preHandler: [app.authenticate] }, handlers.listHandler);

  app.post('/api/modules', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.createModuleSchema,
  }, handlers.createHandler);

  app.put('/api/modules/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.updateModuleSchema,
  }, handlers.updateHandler);

  app.post('/api/plans/:id/modules', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.linkModuleSchema,
  }, handlers.linkHandler);

  app.delete('/api/plans/:id/modules/:moduleId', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
  }, handlers.unlinkHandler);

  app.post('/api/user-modules', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.userModuleOverrideSchema,
  }, handlers.userModuleOverrideHandler);
}
