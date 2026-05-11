import type { FastifyInstance } from 'fastify';
import { slugParamsSchema, publicBookingSchema } from './schemas.js';
import { getBusinessHandler, getServicesHandler, getCombosHandler, createBookingHandler } from './handlers.js';

export async function publicRoutes(app: FastifyInstance) {
  app.get('/api/public/:slug', {
    schema: slugParamsSchema,
  }, getBusinessHandler);

  app.get('/api/public/:slug/services', {
    schema: slugParamsSchema,
  }, getServicesHandler);

  app.get('/api/public/:slug/combos', {
    schema: slugParamsSchema,
  }, getCombosHandler);

  app.post('/api/public/:slug/appointments', {
    schema: publicBookingSchema,
  }, createBookingHandler);
}
