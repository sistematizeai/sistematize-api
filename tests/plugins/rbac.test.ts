import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { authPlugin } from '../../src/plugins/auth.js';
import { rbacPlugin } from '../../src/plugins/rbac.js';

const JWT_SECRET = 'test-secret-key-for-testing-only';

describe('rbacPlugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(rbacPlugin);

    app.get('/admin-only', {
      preHandler: [app.authenticate, app.requireRole(['master_admin'])],
    }, async () => ({ ok: true }));

    app.get('/owner-or-admin', {
      preHandler: [app.authenticate, app.requireRole(['master_admin', 'owner'])],
    }, async () => ({ ok: true }));

    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  function makeToken(role: string) {
    return jwt.sign({ sub: 'u1', role, business_id: 'b1' }, JWT_SECRET);
  }

  it('allows master_admin to admin-only route', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin-only',
      headers: { authorization: `Bearer ${makeToken('master_admin')}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('blocks owner from admin-only route', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin-only',
      headers: { authorization: `Bearer ${makeToken('owner')}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows owner to owner-or-admin route', async () => {
    const res = await app.inject({
      method: 'GET', url: '/owner-or-admin',
      headers: { authorization: `Bearer ${makeToken('owner')}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
