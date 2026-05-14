import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function businessRoutes(app: FastifyInstance) {
  app.get('/api/businesses/me', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.getMyBusinessHandler));

  app.put('/api/businesses/me', {
    preHandler: [app.authenticate],
    schema: schemas.updateBusinessSchema,
  }, routeHandler(handlers.updateMyBusinessHandler));

  app.get('/api/businesses/stats', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, routeHandler(handlers.statsHandler));

  app.get('/api/businesses', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, routeHandler(handlers.listHandler));

  app.get('/api/businesses/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin', 'sub_admin'])],
  }, routeHandler(handlers.getByIdHandler));

  app.put('/api/businesses/:id', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.adminUpdateBusinessSchema,
  }, routeHandler(handlers.adminUpdateHandler));

  app.patch('/api/businesses/:id/status', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    schema: schemas.updateStatusSchema,
  }, routeHandler(handlers.updateStatusHandler));

  app.post('/api/businesses/me/logo', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.uploadLogoHandler));

  app.post('/api/businesses/me/cover', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.uploadCoverHandler));

  app.post('/api/businesses/block-expired', {
    preHandler: [app.authenticate, app.requireRole(['master_admin'])],
  }, routeHandler(handlers.blockExpiredHandler));
}
