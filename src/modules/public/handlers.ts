import type { FastifyRequest, FastifyReply } from 'fastify';
import * as publicService from './service.js';

export async function getBusinessHandler(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
) {
  const business = await publicService.getBusinessBySlug(request.params.slug);
  return reply.send(business);
}

export async function getServicesHandler(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
) {
  const business = await publicService.getBusinessBySlug(request.params.slug);
  const services = await publicService.getPublicServices(business.id);
  return reply.send(services);
}

export async function getCombosHandler(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
) {
  const business = await publicService.getBusinessBySlug(request.params.slug);
  const combos = await publicService.getPublicCombos(business.id);
  return reply.send(combos);
}

export async function getAvailabilityHandler(
  request: FastifyRequest<{ Params: { slug: string }; Querystring: { service_id?: string; combo_id?: string; collaborator_id?: string; date: string } }>,
  reply: FastifyReply
) {
  const availability = await publicService.getPublicAvailability(request.params.slug, request.query);
  return reply.send(availability);
}

export async function deleteClientDataHandler(
  request: FastifyRequest<{ Params: { slug: string }; Body: { client_phone: string; confirm: boolean } }>,
  reply: FastifyReply
) {
  const result = await publicService.deleteClientData(request.params.slug, request.body.client_phone);
  return reply.send(result);
}

export async function getClientDataHandler(
  request: FastifyRequest<{ Params: { slug: string }; Body: { client_phone: string } }>,
  reply: FastifyReply
) {
  const data = await publicService.getClientData(request.params.slug, request.body.client_phone);
  return reply.send(data);
}

export async function createBookingHandler(
  request: FastifyRequest<{ Params: { slug: string }; Body: { client_name: string; client_phone: string; client_email?: string; service_id?: string; combo_id?: string; collaborator_id?: string; date: string; start_time: string; notes?: string } }>,
  reply: FastifyReply
) {
  try {
    const appointment = await publicService.createPublicBooking(request.params.slug, request.body);
    return reply.status(201).send(appointment);
  } catch (err) {
    request.log.error({
      err,
      request_id: request.id,
      slug: request.params.slug,
      date: request.body.date,
      start_time: request.body.start_time,
      has_service: Boolean(request.body.service_id),
      has_combo: Boolean(request.body.combo_id),
    }, 'Public booking creation failed');
    throw err;
  }
}
