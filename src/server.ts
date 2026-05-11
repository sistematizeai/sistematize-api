import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
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
import { categoryRoutes } from './modules/categories/routes.js';
import { serviceRoutes } from './modules/services/routes.js';
import { collaboratorRoutes } from './modules/collaborators/routes.js';
import { clientRoutes } from './modules/clients/routes.js';
import { appointmentRoutes } from './modules/appointments/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { publicRoutes } from './modules/public/routes.js';
import { comboRoutes } from './modules/combos/routes.js';
import { getSupabaseAdmin } from './config/supabase.js';

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    trustProxy: true,
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  const corsOrigins = [env.FRONTEND_ADMIN_URL, env.FRONTEND_DASHBOARD_URL, env.FRONTEND_PUBLIC_URL];
  if (process.env.FRONTEND_TUNNEL_URL) corsOrigins.push(process.env.FRONTEND_TUNNEL_URL);
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.setErrorHandler(errorHandler);
  await registerRateLimit(app);
  await registerSanitizer(app);

  await app.register(authPlugin);
  await app.register(rbacPlugin);
  await app.register(auditPlugin);

  app.get('/health', async () => {
    try {
      const { error } = await getSupabaseAdmin().from('businesses').select('id', { count: 'exact', head: true }).limit(1);
      return { status: error ? 'degraded' : 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', timestamp: new Date().toISOString() };
    }
  });
  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(businessRoutes);
  await app.register(planRoutes);
  await app.register(moduleRoutes);
  await app.register(auditRoutes);
  await app.register(categoryRoutes);
  await app.register(serviceRoutes);
  await app.register(collaboratorRoutes);
  await app.register(clientRoutes);
  await app.register(appointmentRoutes);
  await app.register(dashboardRoutes);
  await app.register(publicRoutes);
  await app.register(comboRoutes);

  return app;
}

async function start() {
  const env = loadEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);

    // Warmup: wake Supabase connection to avoid cold-start latency on first request
    getSupabaseAdmin().from('businesses').select('id', { count: 'exact', head: true }).limit(1)
      .then(() => app.log.info('Supabase connection warmed up'))
      .catch(() => app.log.warn('Supabase warmup failed — first requests may be slow'));
    const shutdown = async (signal: string) => {
      app.log.info(`${signal} received, shutting down gracefully`);
      await app.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
