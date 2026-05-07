import { describe, it, expect } from 'vitest';

describe('Clients Module', () => {
  it('schemas export correctly', async () => {
    const schemas = await import('../../src/modules/clients/schemas.js');
    expect(schemas.createClientSchema).toBeDefined();
    expect(schemas.listClientsQuerySchema).toBeDefined();
  });

  it('service exports findOrCreateClientByPhone', async () => {
    const service = await import('../../src/modules/clients/service.js');
    expect(typeof service.findOrCreateClientByPhone).toBe('function');
  });
});
