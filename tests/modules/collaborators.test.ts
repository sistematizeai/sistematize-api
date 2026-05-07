import { describe, it, expect } from 'vitest';

describe('Collaborators Module', () => {
  it('schemas export correctly', async () => {
    const schemas = await import('../../src/modules/collaborators/schemas.js');
    expect(schemas.createCollaboratorSchema).toBeDefined();
    expect(schemas.updateCollaboratorServicesSchema.body.required).toContain('services');
  });

  it('handlers export correctly', async () => {
    const handlers = await import('../../src/modules/collaborators/handlers.js');
    expect(typeof handlers.listHandler).toBe('function');
    expect(typeof handlers.updateServicesHandler).toBe('function');
  });
});
