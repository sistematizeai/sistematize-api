import type { FastifyInstance } from 'fastify';
import { processAsaasWebhook } from './service.js';

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
}
