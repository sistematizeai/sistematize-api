import type { FastifyInstance } from 'fastify';
import { routeHandler } from '../../utils/route-handler.js';
import {
  statsHandler,
  upcomingHandler,
  collaboratorPerformanceHandler,
  revenueChartHandler,
  appointmentsByStatusHandler,
  revenueByServiceHandler,
  popularServicesHandler,
  dailyAppointmentsHandler,
  peakHoursHandler,
} from './handlers.js';

export async function dashboardRoutes(app: FastifyInstance) {
  const opts = { preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId] };

  app.get('/api/dashboard/stats', opts, routeHandler(statsHandler));
  app.get('/api/dashboard/upcoming', opts, routeHandler(upcomingHandler));
  app.get('/api/dashboard/collaborator-performance', opts, routeHandler(collaboratorPerformanceHandler));
  app.get('/api/dashboard/revenue-chart', opts, routeHandler(revenueChartHandler));
  app.get('/api/dashboard/appointments-by-status', opts, routeHandler(appointmentsByStatusHandler));
  app.get('/api/dashboard/revenue-by-service', opts, routeHandler(revenueByServiceHandler));
  app.get('/api/dashboard/popular-services', opts, routeHandler(popularServicesHandler));
  app.get('/api/dashboard/daily-appointments', opts, routeHandler(dailyAppointmentsHandler));
  app.get('/api/dashboard/peak-hours', opts, routeHandler(peakHoursHandler));
}
