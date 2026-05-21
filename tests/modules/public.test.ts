import { afterEach, describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { errorHandler, ValidationError } from '../../src/utils/errors.js';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('Public Module', () => {
  describe('schemas', () => {
    it('publicBookingSchema requires client_name, client_phone, date, start_time', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      expect(publicBookingSchema.body.required).toEqual(['client_name', 'client_phone', 'date', 'start_time']);
      expect(publicBookingSchema.body.properties.client_email).toBeDefined();
      expect(publicBookingSchema.body.properties.lgpd_consent).toBeDefined();
    });

    it('clientDataRequestSchema requires client_phone only', async () => {
      const { clientDataRequestSchema } = await import('../../src/modules/public/schemas.js');
      expect(clientDataRequestSchema.body.required).toEqual(['client_phone']);
      expect(clientDataRequestSchema.body.properties.client_phone.pattern).toBe('^[0-9]+$');
    });

    it('clientDataDeleteSchema requires client_phone and confirm', async () => {
      const { clientDataDeleteSchema } = await import('../../src/modules/public/schemas.js');
      expect(clientDataDeleteSchema.body.required).toEqual(['client_phone', 'confirm']);
      expect(clientDataDeleteSchema.body.properties.confirm.enum).toEqual([true]);
    });

    it('availabilityQuerySchema requires date and accepts service, combo and collaborator filters', async () => {
      const { availabilityQuerySchema } = await import('../../src/modules/public/schemas.js');
      expect(availabilityQuerySchema.querystring.required).toContain('date');
      expect(availabilityQuerySchema.querystring.properties.service_id.format).toBe('uuid');
      expect(availabilityQuerySchema.querystring.properties.combo_id.format).toBe('uuid');
      expect(availabilityQuerySchema.querystring.properties.collaborator_id.format).toBe('uuid');
    });

    it('phone field rejects non-numeric characters', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      const pattern = new RegExp(publicBookingSchema.body.properties.client_phone.pattern);
      expect(pattern.test('11999887766')).toBe(true);
      expect(pattern.test('(11)9998-8776')).toBe(false);
      expect(pattern.test('abc')).toBe(false);
    });

    it('start_time field validates HH:MM format', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      const pattern = new RegExp(publicBookingSchema.body.properties.start_time.pattern);
      expect(pattern.test('09:30')).toBe(true);
      expect(pattern.test('14:00')).toBe(true);
      expect(pattern.test('9:30')).toBe(false);
      expect(pattern.test('25:00')).toBe(true); // pattern only validates format, not range
    });
  });

  describe('schema validation with Fastify', () => {
    it('rejects booking with missing required fields', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      const app = Fastify({ logger: false });
      app.post('/test/:slug', { schema: publicBookingSchema }, async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test/my-salon',
        payload: { client_name: 'Ana' },
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('strips extra fields via additionalProperties: false (Fastify removeAdditional)', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      const app = Fastify({ logger: false });
      let receivedBody: any;
      app.post('/test/:slug', { schema: publicBookingSchema }, async (req) => {
        receivedBody = req.body;
        return { ok: true };
      });
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/test/my-salon',
        payload: {
          client_name: 'Ana',
          client_phone: '11999887766',
          date: '2026-06-01',
          start_time: '10:00',
          hacker_field: 'xss',
        },
      });
      expect(receivedBody).not.toHaveProperty('hacker_field');
      await app.close();
    });

    it('accepts valid booking payload', async () => {
      const { publicBookingSchema } = await import('../../src/modules/public/schemas.js');
      const app = Fastify({ logger: false });
      app.post('/test/:slug', { schema: publicBookingSchema }, async () => ({ ok: true }));
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/test/my-salon',
        payload: {
          client_name: 'Ana Silva',
          client_phone: '11999887766',
          date: '2026-06-01',
          start_time: '10:00',
          service_id: '550e8400-e29b-41d4-a716-446655440000',
          client_email: 'ana@email.com',
          lgpd_consent: true,
        },
      });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('clientDataDeleteSchema has correct structure for security', async () => {
      const { clientDataDeleteSchema } = await import('../../src/modules/public/schemas.js');
      expect(clientDataDeleteSchema.body.required).toContain('confirm');
      expect(clientDataDeleteSchema.body.additionalProperties).toBe(false);
      expect(clientDataDeleteSchema.body.properties.client_phone.minLength).toBe(10);
    });
  });

  describe('handlers export', () => {
    it('exports all public handlers', async () => {
      const handlers = await import('../../src/modules/public/handlers.js');
      expect(typeof handlers.getBusinessHandler).toBe('function');
      expect(typeof handlers.getServicesHandler).toBe('function');
      expect(typeof handlers.getCombosHandler).toBe('function');
      expect(typeof handlers.createBookingHandler).toBe('function');
      expect(typeof handlers.getAvailabilityHandler).toBe('function');
      expect(typeof handlers.getClientDataHandler).toBe('function');
      expect(typeof handlers.deleteClientDataHandler).toBe('function');
    });
  });

  describe('availability slots', () => {
    it('excludes occupied intervals and lunch break', async () => {
      const service = await import('../../src/modules/public/service.js');
      const slots = service.buildAvailableSlots({
        date: '2026-05-20',
        durationMinutes: 60,
        workStart: '09:00',
        workEnd: '13:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        appointments: [{ start_time: '10:00', end_time: '11:00' }],
        stepMinutes: 30,
      });

      expect(slots).toEqual(['09:00', '11:00']);
    });
  });

  describe('booking guardrails', () => {
    it('rejects public booking when online booking is disabled', async () => {
      const service = await import('../../src/modules/public/service.js');
      expect(() => service.assertPublicBookingEnabled(false)).toThrow('Agendamento online esta desativado');
    });

    it('rejects inactive services before public appointment creation', async () => {
      const service = await import('../../src/modules/public/service.js');
      expect(() => service.assertPublicServiceActive({ id: 'svc-1', is_active: false })).toThrow('Servico esta inativo');
    });

    it('rejects inactive collaborators before public appointment creation', async () => {
      const service = await import('../../src/modules/public/service.js');
      expect(() => service.assertPublicCollaboratorActive({ id: 'collab-1', is_active: false })).toThrow('Colaborador esta inativo');
    });

    it('public booking route surfaces disabled-booking validation as 422', async () => {
      vi.doMock('../../src/modules/public/service.js', () => ({
        createPublicBooking: vi.fn().mockRejectedValue(new ValidationError('Agendamento online esta desativado para este estabelecimento.')),
      }));

      const { publicRoutes } = await import('../../src/modules/public/routes.js');
      const app = Fastify({ logger: false });
      app.setErrorHandler(errorHandler);
      await publicRoutes(app);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api/public/salao-teste/appointments',
        payload: {
          client_name: 'Ana Silva',
          client_phone: '11999887766',
          service_id: '550e8400-e29b-41d4-a716-446655440000',
          date: '2026-06-01',
          start_time: '10:00',
        },
      });

      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.payload).message).toContain('Agendamento online esta desativado');
      await app.close();
    });
  });
});
