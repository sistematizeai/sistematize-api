import { describe, it, expect } from 'vitest';

describe('Asaas Payments Module', () => {
  describe('schemas', () => {
    it('createPaymentSchema requires clientId, value, dueDate, billingType', async () => {
      const { createPaymentSchema } = await import('../../src/modules/asaas-payments/schemas.js');
      expect(createPaymentSchema.body.required).toEqual(['clientId', 'value', 'dueDate', 'billingType']);
      expect(createPaymentSchema.body.properties.value.exclusiveMinimum).toBe(0);
    });

    it('billingType only accepts valid Asaas types', async () => {
      const { createPaymentSchema } = await import('../../src/modules/asaas-payments/schemas.js');
      const validTypes = createPaymentSchema.body.properties.billingType.enum;
      expect(validTypes).toContain('PIX');
      expect(validTypes).toContain('BOLETO');
      expect(validTypes).toContain('CREDIT_CARD');
      expect(validTypes).toContain('UNDEFINED');
      expect(validTypes).toHaveLength(4);
    });

    it('createAsaasCustomerSchema requires clientId', async () => {
      const { createAsaasCustomerSchema } = await import('../../src/modules/asaas-payments/schemas.js');
      expect(createAsaasCustomerSchema.body.required).toEqual(['clientId']);
    });

    it('listPaymentsQuerySchema accepts filter params', async () => {
      const { listPaymentsQuerySchema } = await import('../../src/modules/asaas-payments/schemas.js');
      expect(listPaymentsQuerySchema.querystring.properties.status).toBeDefined();
      expect(listPaymentsQuerySchema.querystring.properties.billing_type).toBeDefined();
      expect(listPaymentsQuerySchema.querystring.properties.date_from).toBeDefined();
    });

    it('paymentParamsSchema requires id as uuid', async () => {
      const { paymentParamsSchema } = await import('../../src/modules/asaas-payments/schemas.js');
      expect(paymentParamsSchema.params.required).toEqual(['id']);
      expect(paymentParamsSchema.params.properties.id.format).toBe('uuid');
    });
  });

  describe('service exports', () => {
    it('exports createPayment function', async () => {
      const service = await import('../../src/modules/asaas-payments/service.js');
      expect(typeof service.createPayment).toBe('function');
    });

    it('exports handlers', async () => {
      const handlers = await import('../../src/modules/asaas-payments/handlers.js');
      expect(typeof handlers.createPaymentHandler).toBe('function');
      expect(typeof handlers.listPaymentsHandler).toBe('function');
    });
  });
});
