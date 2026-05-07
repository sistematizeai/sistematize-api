import { describe, it, expect } from 'vitest';

describe('Services Module', () => {
  it('schemas export correctly', async () => {
    const schemas = await import('../../src/modules/services/schemas.js');
    expect(schemas.createServiceSchema).toBeDefined();
    expect(schemas.createServiceSchema.body.required).toContain('name');
    expect(schemas.createServiceSchema.body.required).toContain('category_id');
  });

  it('handlers export correctly', async () => {
    const handlers = await import('../../src/modules/services/handlers.js');
    expect(typeof handlers.listHandler).toBe('function');
    expect(typeof handlers.getHandler).toBe('function');
    expect(typeof handlers.createHandler).toBe('function');
    expect(typeof handlers.updateHandler).toBe('function');
    expect(typeof handlers.deleteHandler).toBe('function');
  });
});
