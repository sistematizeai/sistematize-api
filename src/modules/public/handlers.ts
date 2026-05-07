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

export async function createBookingHandler(
  request: FastifyRequest<{ Params: { slug: string }; Body: { client_name: string; client_phone: string; service_id: string; collaborator_id?: string; date: string; start_time: string; notes?: string } }>,
  reply: FastifyReply
) {
  const appointment = await publicService.createPublicBooking(request.params.slug, request.body);
  return reply.status(201).send(appointment);
}
