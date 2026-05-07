import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './config/env.js';
import { errorHandler } from './utils/errors.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { registerSanitizer } from './middleware/sanitize.js';
import { authPlugin } from './plugins/auth.js';
import { rbacPlugin } from './plugins/rbac.js';
import { auditPlugin } from './plugins/audit.js';
import { authRoutes } from './modules/auth/routes.js';
import { profileRoutes } from './modules/profiles/routes.js';
import { businessRoutes } from './modules/businesses/routes.js';
import { planRoutes } from './modules/plans/routes.js';
import { moduleRoutes } from './modules/modules/routes.js';
import { auditRoutes } from './modules/audit/routes.js';

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
  await registerRateLimit(app);
  await registerSanitizer(app);

  await app.register(authPlugin);
  await app.register(rbacPlugin);
  await app.register(auditPlugin);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(businessRoutes);
  await app.register(planRoutes);
  await app.register(moduleRoutes);
  await app.register(auditRoutes);

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
