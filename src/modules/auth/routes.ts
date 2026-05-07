import { FastifyInstance } from 'fastify';
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', { schema: schemas.registerSchema }, handlers.registerHandler);
  app.post('/api/auth/login', { schema: schemas.loginSchema }, handlers.loginHandler);
  app.post('/api/auth/verify-2fa', { schema: schemas.verify2FASchema }, handlers.verify2FAHandler);

  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, handlers.logoutHandler);
  app.post('/api/auth/refresh', { preHandler: [app.authenticate] }, handlers.refreshHandler);
  app.post('/api/auth/2fa/setup', { preHandler: [app.authenticate] }, handlers.setup2FAHandler);
  app.post('/api/auth/2fa/confirm', {
    preHandler: [app.authenticate],
    schema: schemas.confirm2FASchema,
  }, handlers.confirm2FAHandler);
  app.post('/api/auth/complete-registration', {
    preHandler: [app.authenticate],
    schema: schemas.completeRegistrationSchema,
  }, handlers.completeRegistrationHandler);
}
