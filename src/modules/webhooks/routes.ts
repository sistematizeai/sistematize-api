import type { FastifyInstance } from 'fastify';
import { processAsaasWebhook } from './service.js';
import { processPlatformWebhook } from './platform-service.js';
import { blockExpiredTrials } from '../businesses/service.js';
import { sendPendingReminders, sendTrialNotifications } from '../notifications/service.js';
import { retryDuePlatformCardPayments } from '../platform-subscriptions/service.js';

type CronEnv = {
  NODE_ENV?: string;
  CRON_SECRET?: string;
};

export function getCronReadiness(env: CronEnv) {
  if (env.NODE_ENV === 'production' && !env.CRON_SECRET) {
    return { ready: false, reason: 'CRON_SECRET ausente em producao' };
  }
  return { ready: true };
}

export function isCronAuthorized(receivedSecret: string | undefined, env: CronEnv) {
  if (!env.CRON_SECRET) return env.NODE_ENV !== 'production';
  return receivedSecret === env.CRON_SECRET;
}

function validateCronRequest(secret: string | undefined) {
  const readiness = getCronReadiness(process.env);
  if (!readiness.ready) {
    return { statusCode: 503, body: { error: 'CRON_NOT_READY', message: readiness.reason } };
  }
  if (!isCronAuthorized(secret, process.env)) {
    return { statusCode: 401, body: { error: 'Nao autorizado' } };
  }
  return null;
}

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
      request.log.error({ err, request_id: request.id }, 'Erro no webhook Asaas');
      return reply.status(500).send({ error: 'Erro interno', request_id: request.id });
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
      request.log.error({ err, request_id: request.id }, 'Erro no webhook da plataforma');
      return reply.status(500).send({ error: 'Erro interno', request_id: request.id });
    }
  });

  app.post('/cron/block-expired-trials', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const cronSecret = request.headers['x-cron-secret'] as string | undefined;
      const cronError = validateCronRequest(cronSecret);
      if (cronError) return reply.status(cronError.statusCode).send({ ...cronError.body, request_id: request.id });
      const result = await blockExpiredTrials();
      const trialEmails = await sendTrialNotifications();
      return reply.send({ ...result, trialEmails });
    } catch (err) {
      request.log.error({ err, request_id: request.id }, 'Erro no cron de bloqueio de trials');
      return reply.status(500).send({ error: 'Erro interno', request_id: request.id });
    }
  });

  app.post('/cron/send-reminders', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const cronSecret = request.headers['x-cron-secret'] as string | undefined;
      const cronError = validateCronRequest(cronSecret);
      if (cronError) return reply.status(cronError.statusCode).send({ ...cronError.body, request_id: request.id });
      const result = await sendPendingReminders();
      return reply.send(result);
    } catch (err) {
      request.log.error({ err, request_id: request.id }, 'Erro no cron de lembretes');
      return reply.status(500).send({ error: 'Erro interno', request_id: request.id });
    }
  });

  app.post('/cron/retry-platform-billing', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const cronSecret = request.headers['x-cron-secret'] as string | undefined;
      const cronError = validateCronRequest(cronSecret);
      if (cronError) return reply.status(cronError.statusCode).send({ ...cronError.body, request_id: request.id });
      const result = await retryDuePlatformCardPayments();
      return reply.send(result);
    } catch (err) {
      request.log.error({ err, request_id: request.id }, 'Erro no cron de retentativa de cobranca da plataforma');
      return reply.status(500).send({ error: 'Erro interno', request_id: request.id });
    }
  });
}
