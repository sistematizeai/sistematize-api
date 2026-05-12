import type { FastifyInstance } from 'fastify';
import { processAsaasWebhook } from './service.js';
import { processPlatformWebhook } from './platform-service.js';
import { blockExpiredTrials } from '../businesses/service.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/asaas', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const receivedToken = request.headers['asaas-access-token'] as string | undefined;
      const event = request.body as {
        id: string;
        event: string;
        payment?: { id: string; status: string; value: number; netValue: number };
      };

      const result = await processAsaasWebhook(receivedToken, event);

      if (result.error && result.reason === 'unauthorized') {
        return reply.status(401).send({ error: 'Webhook nao autorizado' });
      }

      return reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, 'Erro no webhook Asaas');
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  app.post('/webhooks/platform', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const event = request.body as {
        id: string;
        event: string;
        payment?: {
          id: string;
          status: string;
          value: number;
          netValue: number;
          subscription?: string;
          invoiceUrl?: string;
          bankSlipUrl?: string;
          pixQrCode?: { payload: string; encodedImage: string };
          dueDate?: string;
          paymentDate?: string;
        };
      };

      const result = await processPlatformWebhook(event);
      return reply.status(200).send(result);
    } catch (err) {
      request.log.error(err, 'Erro no webhook da plataforma');
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  app.post('/cron/block-expired-trials', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const cronSecret = request.headers['x-cron-secret'] as string | undefined;
    if (cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return reply.status(401).send({ error: 'Nao autorizado' });
    }
    const result = await blockExpiredTrials();
    return reply.send(result);
  });
}
