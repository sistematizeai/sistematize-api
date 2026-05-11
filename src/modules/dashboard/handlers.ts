import type { FastifyRequest, FastifyReply } from 'fastify';
import * as dashboardService from './service.js';
import { parsePeriod } from './service.js';

type PeriodQuery = { period?: string };

export async function statsHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getStats(request.user.business_id!, period));
}

export async function upcomingHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await dashboardService.getUpcoming(request.user.business_id!));
}

export async function collaboratorPerformanceHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getCollaboratorPerformance(request.user.business_id!, period));
}

export async function revenueChartHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getRevenueChart(request.user.business_id!, period));
}

export async function appointmentsByStatusHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getAppointmentsByStatus(request.user.business_id!, period));
}

export async function revenueByServiceHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getRevenueByService(request.user.business_id!, period));
}

export async function popularServicesHandler(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
) {
  const period = parsePeriod(request.query.period);
  return reply.send(await dashboardService.getPopularServices(request.user.business_id!, period));
}

export async function dailyAppointmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await dashboardService.getDailyAppointments(request.user.business_id!));
}

export async function peakHoursHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await dashboardService.getPeakHours(request.user.business_id!));
}
