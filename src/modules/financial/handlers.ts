import type { FastifyReply, FastifyRequest } from 'fastify';
import * as financialService from './service.js';

export async function createManualIncomeHandler(
  request: FastifyRequest<{ Body: financialService.CreateManualIncomeInput }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const record = await financialService.createManualIncome(businessId, request.body, request.user.sub);

  await request.server.audit(request, {
    action: 'financial.manual_income_created',
    entity_type: 'financial_record',
    entity_id: record.id,
  });

  return reply.status(201).send(record);
}

export async function listFinancialRecordsHandler(
  request: FastifyRequest<{ Querystring: financialService.FinancialRecordFilters }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await financialService.listFinancialRecords(businessId, request.query);
  return reply.send(result);
}

export async function exportFinancialRecordsHandler(
  request: FastifyRequest<{ Querystring: financialService.FinancialRecordFilters }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const csv = await financialService.exportFinancialRecordsCsv(businessId, request.query);
  return reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="financeiro.csv"')
    .send(csv);
}

export async function summaryHandler(
  request: FastifyRequest<{ Querystring: financialService.FinancialRecordFilters }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const summary = await financialService.getFinancialSummary(businessId, request.query || {});
  return reply.send(summary);
}
