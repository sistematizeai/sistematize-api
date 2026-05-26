import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function platformSubscriptionRoutes(app: FastifyInstance) {
  app.get('/api/subscription/plans', { preHandler: [app.authenticate] }, routeHandler(handlers.plansHandler));

  app.get('/api/subscription/current', { preHandler: [app.authenticate] }, routeHandler(handlers.currentHandler));

  app.post('/api/subscription/subscribe', {
    preHandler: [app.authenticate],
    schema: schemas.subscribeSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.subscribeHandler));

  app.put('/api/subscription/upgrade', {
    preHandler: [app.authenticate],
    schema: schemas.upgradeSchema,
  }, routeHandler(handlers.upgradeHandler));

  app.post('/api/subscription/cancel', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.cancelHandler));

  app.get('/api/subscription/invoices', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.invoicesHandler));

  app.get('/api/subscription/checkout/:invoiceId', {
    preHandler: [app.authenticate],
    schema: schemas.checkoutInvoiceSchema,
  }, routeHandler(handlers.checkoutInvoiceHandler));

  app.post('/api/subscription/checkout/:invoiceId/pay-card', {
    preHandler: [app.authenticate],
    schema: schemas.checkoutCardPaymentSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.checkoutCardPaymentHandler));

  app.post('/api/subscription/checkout/:invoiceId/pay-saved-card', {
    preHandler: [app.authenticate],
    schema: schemas.checkoutSavedCardPaymentSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.checkoutSavedCardPaymentHandler));

  app.get('/api/subscription/payment-methods', {
    preHandler: [app.authenticate],
  }, routeHandler(handlers.paymentMethodsHandler));

  app.post('/api/subscription/payment-methods/:paymentMethodId/default', {
    preHandler: [app.authenticate],
    schema: schemas.paymentMethodParamsSchema,
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.setDefaultPaymentMethodHandler));

  app.delete('/api/subscription/payment-methods/:paymentMethodId', {
    preHandler: [app.authenticate],
    schema: schemas.paymentMethodParamsSchema,
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.disablePaymentMethodHandler));

  // Admin-only endpoints
  app.get('/api/admin/subscriptions', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminSubscriptionsHandler));

  app.get('/api/admin/subscriptions/stats', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminRevenueHandler));

  app.get('/api/admin/billing/operations', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminBillingOperationsHandler));

  app.get('/api/admin/billing/invoices', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminBillingInvoicesHandler));

  app.get('/api/admin/billing/invoices/export.csv', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminBillingInvoicesExportHandler));

  app.get('/api/admin/billing/events', {
    preHandler: [app.authenticate, app.requirePermission('finance.read')],
  }, routeHandler(handlers.adminBillingEventsHandler));

  app.post('/api/admin/billing/invoices/:invoiceId/retry', {
    preHandler: [app.authenticate, app.requirePermission('finance.write'), app.requireSensitiveConfirmation],
    schema: schemas.adminBillingInvoiceParamsSchema,
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, routeHandler(handlers.adminRetryBillingInvoiceHandler));

  app.patch('/api/admin/billing/invoices/:invoiceId/review', {
    preHandler: [app.authenticate, app.requirePermission('finance.write'), app.requireSensitiveConfirmation],
    schema: schemas.adminBillingInvoiceReviewSchema,
  }, routeHandler(handlers.adminBillingInvoiceReviewHandler));
}
