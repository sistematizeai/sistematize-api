import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { authPlugin } from '../../src/plugins/auth.js';

const JWT_SECRET = 'test-secret-key-for-testing-only';

describe('authPlugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    app = Fastify({ logger: false });
    await app.register(authPlugin);

    app.get('/protected', { preHandler: [app.authenticate] }, async (request) => {
      return { user: request.user };
    });
    app.post('/protected', { preHandler: [app.authenticate] }, async (request) => {
      return { user: request.user };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no token provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const token = jwt.sign(
      { sub: 'user-123', role: 'owner', business_id: 'biz-456', iss: 'sistematize-api', aud: 'sistematize' },
      JWT_SECRET,
    );
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.sub).toBe('user-123');
    expect(body.user.role).toBe('owner');
    expect(body.user.business_id).toBe('biz-456');
  });

  it('returns 200 with valid token from auth cookie', async () => {
    const token = jwt.sign(
      { sub: 'cookie-user', role: 'owner', business_id: 'biz-cookie', iss: 'sistematize-api', aud: 'sistematize' },
      JWT_SECRET,
    );
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `sistematize_session=${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.sub).toBe('cookie-user');
    expect(body.user.business_id).toBe('biz-cookie');
  });

  it('returns 403 for unsafe cookie-authenticated requests without CSRF header', async () => {
    const token = jwt.sign(
      { sub: 'cookie-user', role: 'owner', business_id: 'biz-cookie', iss: 'sistematize-api', aud: 'sistematize' },
      JWT_SECRET,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { cookie: `sistematize_session=${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 for unsafe cookie-authenticated requests with CSRF header', async () => {
    const token = jwt.sign(
      { sub: 'cookie-user', role: 'owner', business_id: 'biz-cookie', iss: 'sistematize-api', aud: 'sistematize' },
      JWT_SECRET,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `sistematize_session=${token}`,
        'x-sistematize-csrf': '1',
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
