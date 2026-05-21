import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('Profiles Admin Module', () => {
  it('allows operational internal roles in admin schemas', async () => {
    const { adminUpdateProfileSchema, createInternalUserSchema } = await import('../../src/modules/profiles/schemas.js');
    const updateRoles = adminUpdateProfileSchema.body.properties.role.enum;
    const createRoles = createInternalUserSchema.body.properties.role.enum;

    for (const role of ['sub_admin', 'support', 'finance', 'commercial', 'technical']) {
      expect(updateRoles).toContain(role);
      expect(createRoles).toContain(role);
    }
  });

  it('createInternalUserSchema requires name, email, role and permissions', async () => {
    const { createInternalUserSchema } = await import('../../src/modules/profiles/schemas.js');
    expect(createInternalUserSchema.body.required).toEqual(['full_name', 'email', 'role', 'permissions']);
    expect(createInternalUserSchema.body.properties.permissions.items.enum).toContain('businesses.write');
    expect(createInternalUserSchema.body.properties.permissions.items.enum).toContain('finance.read');
  });

  it('exports internal user handlers', async () => {
    const handlers = await import('../../src/modules/profiles/handlers.js');
    expect(typeof handlers.createInternalUserHandler).toBe('function');
    expect(typeof handlers.getDetailHandler).toBe('function');
    expect(typeof handlers.updateStatusHandler).toBe('function');
  });

  it('builds a safe temporary password', async () => {
    const service = await import('../../src/modules/profiles/service.js');
    expect(service.createTemporaryPassword()).toMatch(/^Sis@[A-Fa-f0-9]{16}$/);
  });

  it('rejects master_admin creation through internal user API', async () => {
    const service = await import('../../src/modules/profiles/service.js');
    await expect(service.createInternalUser({
      full_name: 'Root',
      email: 'root@example.com',
      role: 'master_admin',
      permissions: ['users.write'],
    })).rejects.toThrow('Use o provisionamento seguro para master admin.');
  });

  it('requires confirmation for sensitive operation middleware', async () => {
    const { hasSensitiveConfirmation } = await import('../../src/plugins/rbac.js');
    expect(hasSensitiveConfirmation({ headers: { 'x-master-confirmation': 'CONFIRMAR' } })).toBe(true);
    expect(hasSensitiveConfirmation({ headers: {} })).toBe(false);
  });

  it('profile routes use permission middleware for internal staff access', async () => {
    const { profileRoutes } = await import('../../src/modules/profiles/routes.js');
    const routes: any[] = [];
    const app = {
      authenticate: 'auth',
      requirePermission: (permission: string) => `perm:${permission}`,
      requireSensitiveConfirmation: 'sensitive',
      get: (url: string, options: any) => routes.push({ method: 'GET', url, options }),
      post: (url: string, options: any) => routes.push({ method: 'POST', url, options }),
      put: (url: string, options: any) => routes.push({ method: 'PUT', url, options }),
      patch: (url: string, options: any) => routes.push({ method: 'PATCH', url, options }),
    };

    await profileRoutes(app as any);

    const listRoute = routes.find(route => route.method === 'GET' && route.url === '/api/profiles');
    const createRoute = routes.find(route => route.method === 'POST' && route.url === '/api/profiles/internal');
    expect(listRoute.options.preHandler).toContain('perm:users.read');
    expect(createRoute.options.preHandler).toContain('perm:users.write');
    expect(createRoute.options.preHandler).toContain('sensitive');
  });
});
