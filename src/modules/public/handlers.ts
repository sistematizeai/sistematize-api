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
  const appointment = await publicService.createPublicBooking(request.params.slug, request.body);
  return reply.status(201).send(appointment);
}
