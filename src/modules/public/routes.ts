import type { FastifyInstance } from 'fastify';
import { slugParamsSchema, publicBookingSchema, clientDataRequestSchema, clientDataDeleteSchema } from './schemas.js';
import { getBusinessHandler, getServicesHandler, getCombosHandler, getClientDataHandler, deleteClientDataHandler, createBookingHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function publicRoutes(app: FastifyInstance) {
  app.get('/api/public/:slug', {
    schema: slugParamsSchema,
  }, routeHandler(getBusinessHandler));

  app.get('/api/public/:slug/services', {
    schema: slugParamsSchema,
  }, routeHandler(getServicesHandler));

  app.get('/api/public/:slug/combos', {
    schema: slugParamsSchema,
  }, routeHandler(getCombosHandler));

  app.post('/api/public/:slug/delete-data', {
    schema: clientDataDeleteSchema,
    config: {
      rateLimit: {
        max: 2,
        timeWindow: '1 minute',
      },
    },
  }, routeHandler(deleteClientDataHandler));

  app.post('/api/public/:slug/my-data', {
    schema: clientDataRequestSchema,
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      },
    },
  }, routeHandler(getClientDataHandler));

  app.post('/api/public/:slug/appointments', {
    schema: publicBookingSchema,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, routeHandler(createBookingHandler));
}
