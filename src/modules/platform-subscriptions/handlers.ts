import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './service.js';

export async function adminSubscriptionsHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { status, page, limit } = request.query;
  const result = await service.adminListSubscriptions({
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}

export async function adminRevenueHandler(_request: FastifyRequest, reply: FastifyReply) {
  const stats = await service.adminGetRevenueStats();
  reply.send(stats);
}

export async function adminBillingInvoicesHandler(
  request: FastifyRequest<{ Querystring: { status?: string; business_id?: string; search?: string; operational_status?: string; date_from?: string; date_to?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { status, business_id, search, operational_status, date_from, date_to, page, limit } = request.query;
  const result = await service.adminListBillingInvoices({
    status,
    businessId: business_id,
    search,
    operationalStatus: operational_status,
    dateFrom: date_from,
    dateTo: date_to,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}

export async function adminBillingInvoicesExportHandler(
  request: FastifyRequest<{ Querystring: { status?: string; business_id?: string; search?: string; operational_status?: string; date_from?: string; date_to?: string } }>,
  reply: FastifyReply,
) {
  const { status, business_id, search, operational_status, date_from, date_to } = request.query;
  const csv = await service.adminExportBillingInvoicesCsv({
    status,
    businessId: business_id,
    search,
    operationalStatus: operational_status,
    dateFrom: date_from,
    dateTo: date_to,
  });
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="sistematize-cobrancas.csv"')
    .send(csv);
}

export async function adminBillingEventsHandler(
  request: FastifyRequest<{ Querystring: { severity?: string; business_id?: string; search?: string; invoice_id?: string; date_from?: string; date_to?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { severity, business_id, search, invoice_id, date_from, date_to, page, limit } = request.query;
  const result = await service.adminListBillingEvents({
    severity,
    businessId: business_id,
    search,
    invoiceId: invoice_id,
    dateFrom: date_from,
    dateTo: date_to,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}

export async function adminBillingOperationsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await service.adminGetBillingOperations();
  reply.send(result);
}

export async function adminRetryBillingInvoiceHandler(
  request: FastifyRequest<{ Params: { invoiceId: string } }>,
  reply: FastifyReply,
) {
  const result = await service.adminRetryInvoiceWithDefaultCard(request.params.invoiceId);
  reply.send(result);
}

export async function adminBillingInvoiceReviewHandler(
  request: FastifyRequest<{
    Params: { invoiceId: string };
    Body: { operational_status: 'none' | 'in_review'; note?: string | null };
  }>,
  reply: FastifyReply,
) {
  const result = await service.adminUpdateBillingInvoiceReview({
    invoiceId: request.params.invoiceId,
    reviewStatus: request.body.operational_status,
    note: request.body.note,
    reviewedBy: request.user.sub,
  });
  reply.send(result);
}

export async function plansHandler(_request: FastifyRequest, reply: FastifyReply) {
  const plans = await service.getAvailablePlans();
  reply.send(plans);
}

export async function subscribeHandler(
  request: FastifyRequest<{ Body: { plan_id: string; billing_cycle: 'monthly' | 'yearly'; billing_type?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { plan_id, billing_cycle, billing_type } = request.body;
  const result = await service.createSubscription(businessId, plan_id, billing_cycle, billing_type as any);
  reply.status(201).send(result);
}

export async function currentHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const sub = await service.getActiveSubscription(businessId);
  reply.send(sub || { active: false });
}

export async function upgradeHandler(
  request: FastifyRequest<{ Body: { plan_id: string; billing_cycle?: 'monthly' | 'yearly'; billing_type?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { plan_id, billing_cycle, billing_type } = request.body;
  const result = await service.upgradeSubscription(businessId, plan_id, billing_cycle, billing_type as any);
  reply.send(result);
}

export async function cancelHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const result = await service.cancelSubscription(businessId);
  reply.send(result);
}

export async function invoicesHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const { status, page, limit } = request.query;
  const result = await service.listInvoices(businessId, {
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  reply.send(result);
}

export async function checkoutInvoiceHandler(
  request: FastifyRequest<{ Params: { invoiceId: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await service.getCheckoutInvoice(businessId, request.params.invoiceId);
  reply.send(result);
}

export async function checkoutCardPaymentHandler(
  request: FastifyRequest<{
    Params: { invoiceId: string };
    Body: {
      credit_card: {
        holder_name: string;
        number: string;
        expiry_month: string;
        expiry_year: string;
        ccv: string;
      };
      holder_info: {
        name: string;
        email: string;
        cpf_cnpj: string;
        postal_code: string;
        address_number: string;
        phone?: string;
      };
    };
  }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await service.payCheckoutInvoiceWithCard(
    businessId,
    request.params.invoiceId,
    {
      creditCard: {
        holderName: request.body.credit_card.holder_name,
        number: request.body.credit_card.number,
        expiryMonth: request.body.credit_card.expiry_month,
        expiryYear: request.body.credit_card.expiry_year,
        ccv: request.body.credit_card.ccv,
      },
      holderInfo: {
        name: request.body.holder_info.name,
        email: request.body.holder_info.email,
        cpfCnpj: request.body.holder_info.cpf_cnpj,
        postalCode: request.body.holder_info.postal_code,
        addressNumber: request.body.holder_info.address_number,
        phone: request.body.holder_info.phone,
      },
    },
    request.ip,
  );
  reply.send(result);
}

export async function checkoutSavedCardPaymentHandler(
  request: FastifyRequest<{ Params: { invoiceId: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await service.payCheckoutInvoiceWithSavedCard(businessId, request.params.invoiceId);
  reply.send(result);
}

export async function paymentMethodsHandler(request: FastifyRequest, reply: FastifyReply) {
  const businessId = request.user.business_id!;
  const result = await service.listPaymentMethods(businessId);
  reply.send(result);
}

export async function setDefaultPaymentMethodHandler(
  request: FastifyRequest<{ Params: { paymentMethodId: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await service.setDefaultPaymentMethod(businessId, request.params.paymentMethodId, request.ip);
  reply.send(result);
}

export async function disablePaymentMethodHandler(
  request: FastifyRequest<{ Params: { paymentMethodId: string } }>,
  reply: FastifyReply,
) {
  const businessId = request.user.business_id!;
  const result = await service.disablePaymentMethod(businessId, request.params.paymentMethodId);
  reply.send(result);
}
