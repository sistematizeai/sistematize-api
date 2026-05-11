import type { FastifyInstance } from 'fastify';
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

  app.get('/api/dashboard/stats', opts, statsHandler);
  app.get('/api/dashboard/upcoming', opts, upcomingHandler);
  app.get('/api/dashboard/collaborator-performance', opts, collaboratorPerformanceHandler);
  app.get('/api/dashboard/revenue-chart', opts, revenueChartHandler);
  app.get('/api/dashboard/appointments-by-status', opts, appointmentsByStatusHandler);
  app.get('/api/dashboard/revenue-by-service', opts, revenueByServiceHandler);
  app.get('/api/dashboard/popular-services', opts, popularServicesHandler);
  app.get('/api/dashboard/daily-appointments', opts, dailyAppointmentsHandler);
  app.get('/api/dashboard/peak-hours', opts, peakHoursHandler);
}
