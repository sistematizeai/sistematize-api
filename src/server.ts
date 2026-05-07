import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './config/env.js';
import { errorHandler } from './utils/errors.js';

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: [env.FRONTEND_ADMIN_URL, env.FRONTEND_DASHBOARD_URL, env.FRONTEND_PUBLIC_URL],
    credentials: true,
  });

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}

async function start() {
  const env = loadEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
