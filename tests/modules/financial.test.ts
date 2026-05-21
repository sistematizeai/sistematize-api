import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('Financial Module', () => {
  describe('schemas', () => {
    it('createManualIncomeSchema requires amount, payment_method and occurred_on', async () => {
      const { createManualIncomeSchema } = await import('../../src/modules/financial/schemas.js');
      expect(createManualIncomeSchema.body.required).toEqual(['amount', 'payment_method', 'occurred_on']);
      expect(createManualIncomeSchema.body.properties.amount.exclusiveMinimum).toBe(0);
      expect(createManualIncomeSchema.body.properties.payment_method.enum).toEqual(['pix', 'credit', 'debit', 'cash', 'external']);
    });

    it('listFinancialRecordsQuerySchema accepts operational filters', async () => {
      const { listFinancialRecordsQuerySchema } = await import('../../src/modules/financial/schemas.js');
      expect(listFinancialRecordsQuerySchema.querystring.properties.date_from).toBeDefined();
      expect(listFinancialRecordsQuerySchema.querystring.properties.date_to).toBeDefined();
      expect(listFinancialRecordsQuerySchema.querystring.properties.collaborator_id.format).toBe('uuid');
      expect(listFinancialRecordsQuerySchema.querystring.properties.service_id.format).toBe('uuid');
      expect(listFinancialRecordsQuerySchema.querystring.properties.client_id.format).toBe('uuid');
      expect(listFinancialRecordsQuerySchema.querystring.properties.payment_method).toBeDefined();
    });
  });

  describe('service helpers', () => {
    it('calculates collaborator commission from percentage and amount', async () => {
      const { calculateCommissionAmount } = await import('../../src/modules/financial/service.js');
      expect(calculateCommissionAmount(200, 12.5)).toBe(25);
      expect(calculateCommissionAmount(199.9, 10)).toBe(19.99);
    });

    it('exports financial records as stable CSV', async () => {
      const { financialRecordsToCsv } = await import('../../src/modules/financial/service.js');
      const csv = financialRecordsToCsv([
        {
          occurred_on: '2026-05-20',
          type: 'income',
          source: 'manual',
          status: 'received',
          payment_method: 'pix',
          amount: 150,
          commission_amount: 15,
          client: { name: 'Ana Silva' },
          collaborator: { name: 'Joao' },
          service: { name: 'Corte' },
          description: 'Pago no caixa',
        },
      ]);

      expect(csv.split('\n')[0]).toBe('Data,Tipo,Origem,Status,Forma,Cliente,Profissional,Servico,Descricao,Valor,Comissao');
      expect(csv).toContain('2026-05-20,income,manual,received,pix,Ana Silva,Joao,Corte,Pago no caixa,150.00,15.00');
    });

    it('maps Asaas statuses into internal financial statuses', async () => {
      const { mapAsaasStatusToFinancialStatus } = await import('../../src/modules/financial/service.js');
      expect(mapAsaasStatusToFinancialStatus('RECEIVED')).toBe('received');
      expect(mapAsaasStatusToFinancialStatus('CONFIRMED')).toBe('received');
      expect(mapAsaasStatusToFinancialStatus('PENDING')).toBe('pending');
      expect(mapAsaasStatusToFinancialStatus('OVERDUE')).toBe('pending');
      expect(mapAsaasStatusToFinancialStatus('REFUNDED')).toBe('cancelled');
    });
  });

  describe('exports', () => {
    it('exports handlers and routes', async () => {
      const handlers = await import('../../src/modules/financial/handlers.js');
      const routes = await import('../../src/modules/financial/routes.js');

      expect(typeof handlers.createManualIncomeHandler).toBe('function');
      expect(typeof handlers.listFinancialRecordsHandler).toBe('function');
      expect(typeof handlers.exportFinancialRecordsHandler).toBe('function');
      expect(typeof handlers.summaryHandler).toBe('function');
      expect(typeof routes.financialRoutes).toBe('function');
    });

    it('checks financial module access before creating manual income', async () => {
      const accessError = new Error('Modulo financial nao liberado para este plano.');

      vi.doMock('../../src/modules/modules/access-control.js', () => ({
        assertBusinessCanUseModule: vi.fn().mockRejectedValue(accessError),
      }));

      vi.doMock('../../src/config/supabase.js', () => ({
        getSupabaseAdmin: vi.fn(() => {
          throw new Error('Supabase should not be called before financial access check');
        }),
      }));

      const service = await import('../../src/modules/financial/service.js');

      await expect(service.createManualIncome('biz-1', {
        amount: 100,
        payment_method: 'pix',
        occurred_on: '2026-05-20',
      }, 'profile-1')).rejects.toThrow('Modulo financial nao liberado para este plano.');
    });
  });
});
