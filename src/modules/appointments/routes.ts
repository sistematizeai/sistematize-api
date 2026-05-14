import type { FastifyInstance } from 'fastify';
import { createAppointmentSchema, updateAppointmentSchema, updateStatusSchema, appointmentParamsSchema, listAppointmentsQuerySchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, updateStatusHandler, deleteHandler } from './handlers.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function appointmentRoutes(app: FastifyInstance) {
  app.get('/api/appointments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listAppointmentsQuerySchema,
  }, routeHandler(listHandler));

  app.get('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: appointmentParamsSchema,
  }, routeHandler(getHandler));

  app.post('/api/appointments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: createAppointmentSchema,
  }, routeHandler(createHandler));

  app.put('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner', 'collaborator']), app.requireBusinessId],
    schema: updateAppointmentSchema,
  }, routeHandler(updateHandler));

  app.patch('/api/appointments/:id/status', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: updateStatusSchema,
  }, routeHandler(updateStatusHandler));

  app.delete('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: appointmentParamsSchema,
  }, routeHandler(deleteHandler));
}
