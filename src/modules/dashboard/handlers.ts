import type { FastifyRequest, FastifyReply } from 'fastify';
import * as dashboardService from './service.js';

export async function statsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await dashboardService.getStats(request.user.business_id!);
  return reply.send(stats);
}

export async function upcomingHandler(request: FastifyRequest, reply: FastifyReply) {
  const upcoming = await dashboardService.getUpcoming(request.user.business_id!);
  return reply.send(upcoming);
}

export async function collaboratorPerformanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const performance = await dashboardService.getCollaboratorPerformance(request.user.business_id!);
  return reply.send(performance);
}
