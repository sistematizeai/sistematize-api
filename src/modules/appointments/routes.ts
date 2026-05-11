import type { FastifyInstance } from 'fastify';
import { createAppointmentSchema, updateAppointmentSchema, updateStatusSchema, appointmentParamsSchema, listAppointmentsQuerySchema } from './schemas.js';
import { listHandler, getHandler, createHandler, updateHandler, updateStatusHandler, deleteHandler } from './handlers.js';

export async function appointmentRoutes(app: FastifyInstance) {
  app.get('/api/appointments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listAppointmentsQuerySchema,
  }, listHandler);

  app.get('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: appointmentParamsSchema,
  }, getHandler);

  app.post('/api/appointments', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: createAppointmentSchema,
  }, createHandler);

  app.put('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner', 'collaborator']), app.requireBusinessId],
    schema: updateAppointmentSchema,
  }, updateHandler);

  app.patch('/api/appointments/:id/status', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: updateStatusSchema,
  }, updateStatusHandler);

  app.delete('/api/appointments/:id', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: appointmentParamsSchema,
  }, deleteHandler);
}
