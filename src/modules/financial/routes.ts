import type { FastifyInstance } from 'fastify';
import { routeHandler } from '../../utils/route-handler.js';
import { createManualIncomeSchema, listFinancialRecordsQuerySchema } from './schemas.js';
import {
  createManualIncomeHandler,
  exportFinancialRecordsHandler,
  listFinancialRecordsHandler,
  summaryHandler,
} from './handlers.js';

export async function financialRoutes(app: FastifyInstance) {
  app.get('/api/financial/records', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listFinancialRecordsQuerySchema,
  }, routeHandler(listFinancialRecordsHandler));

  app.get('/api/financial/summary', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listFinancialRecordsQuerySchema,
  }, routeHandler(summaryHandler));

  app.get('/api/financial/export', {
    preHandler: [app.authenticate, app.requireBusinessId],
    schema: listFinancialRecordsQuerySchema,
  }, routeHandler(exportFinancialRecordsHandler));

  app.post('/api/financial/manual-income', {
    preHandler: [app.authenticate, app.requireRole(['owner']), app.requireBusinessId],
    schema: createManualIncomeSchema,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, routeHandler(createManualIncomeHandler));
}
