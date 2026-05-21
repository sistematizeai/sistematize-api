import type { FastifyRequest, FastifyReply } from 'fastify';
import * as appointmentService from './service.js';

export async function listHandler(
  request: FastifyRequest<{ Querystring: { date?: string; status?: string; collaborator_id?: string; date_from?: string; date_to?: string; page?: number; limit?: number } }>,
  reply: FastifyReply
) {
  const result = await appointmentService.listAppointments(request.user.business_id!, request.query);
  return reply.send(result);
}

export async function getHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const appointment = await appointmentService.getAppointment(request.params.id, request.user.business_id!);
  return reply.send(appointment);
}

export async function createHandler(
  request: FastifyRequest<{ Body: { client_id: string; collaborator_id: string; date: string; start_time: string; service_ids: string[]; notes?: string; source?: string } }>,
  reply: FastifyReply
) {
  const appointment = await appointmentService.createAppointment(request.user.business_id!, request.body, request.user.sub);
  await request.server.audit(request, {
    action: 'create',
    entity_type: 'appointment',
    entity_id: appointment.id,
    new_data: appointment,
  });
  return reply.status(201).send(appointment);
}

export async function updateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { collaborator_id?: string; date?: string; start_time?: string; notes?: string; payment_method?: string; cancel_reason?: string } }>,
  reply: FastifyReply
) {
  const appointment = await appointmentService.updateAppointment(request.params.id, request.user.business_id!, request.body);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'appointment',
    entity_id: request.params.id,
    new_data: appointment,
  });
  return reply.send(appointment);
}

export async function updateStatusHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
  reply: FastifyReply
) {
  const appointment = await appointmentService.updateStatus(request.params.id, request.user.business_id!, request.body.status);
  await request.server.audit(request, {
    action: 'update',
    entity_type: 'appointment',
    entity_id: appointment.id,
    new_data: { status: appointment.status },
  });
  return reply.send(appointment);
}

export async function deleteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await appointmentService.updateStatus(request.params.id, request.user.business_id!, 'cancelled');
  await request.server.audit(request, {
    action: 'delete',
    entity_type: 'appointment',
    entity_id: request.params.id,
    new_data: { status: 'cancelled' },
  });
  return reply.status(204).send();
}
