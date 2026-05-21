import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
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
import { integrationRoutes } from './modules/integrations/routes.js';
import { asaasPaymentRoutes } from './modules/asaas-payments/routes.js';
import { financialRoutes } from './modules/financial/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { platformSubscriptionRoutes } from './modules/platform-subscriptions/routes.js';
import { getSupabaseAdmin } from './config/supabase.js';

type HealthCheck = {
  status: 'ok' | 'degraded' | 'missing_config' | 'skipped';
  message?: string;
  latency_ms?: number;
};

function getIncomingRequestId(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length > 128) return randomUUID();
  return /^[a-zA-Z0-9._:-]+$/.test(value) ? value : randomUUID();
}

async function buildHealthChecks(env: ReturnType<typeof loadEnv>): Promise<Record<string, HealthCheck>> {
  const checks: Record<string, HealthCheck> = {};
  const started = Date.now();

  try {
    const { error } = await getSupabaseAdmin().from('businesses').select('id', { count: 'exact', head: true }).limit(1);
    checks.supabase = error
      ? { status: 'degraded', message: error.message, latency_ms: Date.now() - started }
      : { status: 'ok', latency_ms: Date.now() - started };
  } catch (err) {
    checks.supabase = {
      status: 'degraded',
      message: err instanceof Error ? err.message : 'Supabase health check failed',
      latency_ms: Date.now() - started,
    };
  }

  checks.asaas_platform = env.ASAAS_PLATFORM_API_KEY && env.ASAAS_PLATFORM_WALLET_ID
    ? { status: 'ok', message: `configured:${env.ASAAS_PLATFORM_ENV}` }
    : { status: env.NODE_ENV === 'production' ? 'missing_config' : 'skipped', message: 'ASAAS_PLATFORM_API_KEY/ASAAS_PLATFORM_WALLET_ID ausentes' };

  checks.resend = env.RESEND_API_KEY
    ? { status: 'ok' }
    : { status: env.NODE_ENV === 'production' ? 'missing_config' : 'skipped', message: 'RESEND_API_KEY ausente' };

  checks.cron = env.CRON_SECRET
    ? { status: 'ok' }
    : { status: env.NODE_ENV === 'production' ? 'missing_config' : 'skipped', message: 'CRON_SECRET ausente' };

  return checks;
}

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    trustProxy: true,
    genReqId: (req) => getIncomingRequestId(req.headers['x-request-id']),
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode >= 500) {
      request.log.error({
        request_id: request.id,
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
      }, 'Request finished with server error');
    }
  });

  const corsOrigins = [env.FRONTEND_ADMIN_URL, env.FRONTEND_DASHBOARD_URL, env.FRONTEND_PUBLIC_URL];
  if (process.env.FRONTEND_TUNNEL_URL) corsOrigins.push(process.env.FRONTEND_TUNNEL_URL);
  await app.register(cookie);
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

  app.get('/health', async (_request, reply) => {
    const checks = await buildHealthChecks(env);
    const degraded = Object.values(checks).some(check => check.status === 'degraded' || check.status === 'missing_config');
    return reply.status(degraded ? 503 : 200).send({
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
    });
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
  await app.register(integrationRoutes);
  await app.register(asaasPaymentRoutes);
  await app.register(financialRoutes);
  await app.register(webhookRoutes);
  await app.register(platformSubscriptionRoutes);

  return app;
}

async function start() {
  const env = loadEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);

    // Warmup: wake Supabase connection to avoid cold-start latency on first request
    void (async () => {
      try {
        await getSupabaseAdmin().from('businesses').select('id', { count: 'exact', head: true }).limit(1);
        app.log.info('Supabase connection warmed up');
      } catch {
        app.log.warn('Supabase warmup failed - first requests may be slow');
      }
    })();
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

start().catch(err => {
  console.error('FATAL: Failed to start server:', err);
  process.exit(1);
});
