import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';
import { routeHandler } from '../../utils/route-handler.js';

export async function authRoutes(app: FastifyInstance) {
  const authRateLimit = {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  };

  const resendRateLimit = {
    config: {
      rateLimit: { max: 3, timeWindow: '1 minute' },
    },
  };

  app.post('/api/auth/register', { schema: schemas.registerSchema, ...authRateLimit }, routeHandler(handlers.registerHandler));
  app.post('/api/auth/login', { schema: schemas.loginSchema, ...authRateLimit }, routeHandler(handlers.loginHandler));
  app.post('/api/auth/verify-2fa', { schema: schemas.verify2FASchema, ...authRateLimit }, routeHandler(handlers.verify2FAHandler));
  app.post('/api/auth/resend-confirmation', { schema: schemas.resendConfirmationSchema, ...resendRateLimit }, routeHandler(handlers.resendConfirmationHandler));
  app.post('/api/auth/confirm-email', { schema: schemas.confirmEmailSchema, ...authRateLimit }, routeHandler(handlers.confirmEmailHandler));

  app.post('/api/auth/logout', routeHandler(handlers.logoutHandler));
  app.post('/api/auth/refresh', { preHandler: [app.authenticate] }, routeHandler(handlers.refreshHandler));
  app.post('/api/auth/2fa/setup', { preHandler: [app.authenticate] }, routeHandler(handlers.setup2FAHandler));
  app.post('/api/auth/2fa/confirm', {
    preHandler: [app.authenticate],
    schema: schemas.confirm2FASchema,
  }, routeHandler(handlers.confirm2FAHandler));
  app.post('/api/auth/complete-registration', {
    preHandler: [app.authenticate],
    schema: schemas.completeRegistrationSchema,
  }, routeHandler(handlers.completeRegistrationHandler));
}
