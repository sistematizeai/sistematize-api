import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler, ForbiddenError } from '../../src/utils/errors.js';

function buildReplyBody(response: { payload: string }) {
  return JSON.parse(response.payload);
}

async function buildRouteApp(registerRoutes: (app: any) => Promise<void>) {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', async (request: any) => {
    request.user = { sub: 'profile-1', role: 'owner', business_id: 'biz-1' };
  });
  app.decorate('requireBusinessId', async () => {});
  app.decorate('requireRole', () => async () => {});
  app.decorate('audit', async () => {});
  await registerRoutes(app);
  await app.ready();
  return app;
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('route-level module enforcement', () => {
  it('returns 403 when service creation is blocked by plan modules', async () => {
    vi.doMock('../../src/modules/services/service.js', () => ({
      createService: vi.fn().mockRejectedValue(new ForbiddenError('Modulo services nao liberado para este plano.')),
    }));

    const { serviceRoutes } = await import('../../src/modules/services/routes.js');
    const app = await buildRouteApp(serviceRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/api/services',
      payload: {
        name: 'Corte',
        category_id: '11111111-1111-4111-8111-111111111111',
        price: 50,
        duration_minutes: 30,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(buildReplyBody(response).message).toContain('Modulo services nao liberado');
    await app.close();
  });

  it('returns 403 when appointment creation is blocked by plan modules', async () => {
    vi.doMock('../../src/modules/appointments/service.js', () => ({
      createAppointment: vi.fn().mockRejectedValue(new ForbiddenError('Modulo appointments nao liberado para este plano.')),
    }));

    const { appointmentRoutes } = await import('../../src/modules/appointments/routes.js');
    const app = await buildRouteApp(appointmentRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/api/appointments',
      payload: {
        client_id: '11111111-1111-4111-8111-111111111111',
        collaborator_id: '22222222-2222-4222-8222-222222222222',
        date: '2026-05-21',
        start_time: '10:00',
        service_ids: ['33333333-3333-4333-8333-333333333333'],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(buildReplyBody(response).message).toContain('Modulo appointments nao liberado');
    await app.close();
  });

  it('returns 403 when payment creation is blocked by the financial module', async () => {
    vi.doMock('../../src/modules/asaas-payments/service.js', () => ({
      createPayment: vi.fn().mockRejectedValue(new ForbiddenError('Modulo financial nao liberado para este plano.')),
    }));

    const { asaasPaymentRoutes } = await import('../../src/modules/asaas-payments/routes.js');
    const app = await buildRouteApp(asaasPaymentRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/api/asaas/payments',
      payload: {
        clientId: '11111111-1111-4111-8111-111111111111',
        value: 100,
        dueDate: '2026-05-21',
        billingType: 'PIX',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(buildReplyBody(response).message).toContain('Modulo financial nao liberado');
    await app.close();
  });
});
