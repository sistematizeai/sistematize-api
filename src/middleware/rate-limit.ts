import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (request.headers['x-forwarded-for'] as string) || request.ip;
    },
    errorResponseBuilder: () => ({
      error: 'RATE_LIMIT',
      message: 'Muitas requisicoes. Tente novamente em alguns minutos.',
    }),
  });
}
