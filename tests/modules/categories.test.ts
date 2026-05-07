import { describe, it, expect } from 'vitest';

describe('Categories Module', () => {
  it('schemas export correctly', async () => {
    const schemas = await import('../../src/modules/categories/schemas.js');
    expect(schemas.createCategorySchema).toBeDefined();
    expect(schemas.createCategorySchema.body.required).toContain('name');
  });

  it('handlers export correctly', async () => {
    const handlers = await import('../../src/modules/categories/handlers.js');
    expect(typeof handlers.listHandler).toBe('function');
    expect(typeof handlers.createHandler).toBe('function');
    expect(typeof handlers.updateHandler).toBe('function');
    expect(typeof handlers.deleteHandler).toBe('function');
  });
});
