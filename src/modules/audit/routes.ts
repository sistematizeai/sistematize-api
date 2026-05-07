import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/audit-logs', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.listAuditSchema,
  }, handlers.listHandler);
}
