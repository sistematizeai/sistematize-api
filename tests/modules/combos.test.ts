import { describe, it, expect } from 'vitest';

describe('Combos Module', () => {
  it('createComboSchema requires name and validates service_ids array', async () => {
    const { createComboSchema } = await import('../../src/modules/combos/schemas.js');
    expect(createComboSchema.body.required).toEqual(['name']);
    expect(createComboSchema.body.properties.service_ids.type).toBe('array');
    expect(createComboSchema.body.properties.service_ids.minItems).toBe(1);
    expect(createComboSchema.body.properties.discount_percent.maximum).toBe(100);
    expect(createComboSchema.body.properties.duration_minutes.maximum).toBe(480);
  });

  it('exports combo handlers', async () => {
    const handlers = await import('../../src/modules/combos/handlers.js');
    expect(typeof handlers.createHandler).toBe('function');
    expect(typeof handlers.listHandler).toBe('function');
    expect(typeof handlers.updateHandler).toBe('function');
    expect(typeof handlers.deleteHandler).toBe('function');
  });
});
