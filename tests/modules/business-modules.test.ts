import { describe, expect, it } from 'vitest';

describe('business module availability', () => {
  it('keeps plan modules active by default', async () => {
    const { buildAvailableModules } = await import('../../src/modules/businesses/service.js');

    expect(buildAvailableModules([
      { id: 'mod-services', name: 'Servicos', slug: 'services' },
      { id: 'mod-financial', name: 'Financeiro', slug: 'financial' },
    ], [])).toEqual([
      { id: 'mod-services', name: 'Servicos', slug: 'services', source: 'plan' },
      { id: 'mod-financial', name: 'Financeiro', slug: 'financial', source: 'plan' },
    ]);
  });

  it('lets user module overrides add or remove modules from the effective list', async () => {
    const { buildAvailableModules } = await import('../../src/modules/businesses/service.js');

    expect(buildAvailableModules([
      { id: 'mod-services', name: 'Servicos', slug: 'services' },
      { id: 'mod-financial', name: 'Financeiro', slug: 'financial' },
    ], [
      { is_active: false, module: { id: 'mod-financial', name: 'Financeiro', slug: 'financial' } },
      { is_active: true, module: { id: 'mod-collaborators', name: 'Colaboradores', slug: 'collaborators' } },
    ])).toEqual([
      { id: 'mod-services', name: 'Servicos', slug: 'services', source: 'plan' },
      { id: 'mod-collaborators', name: 'Colaboradores', slug: 'collaborators', source: 'override' },
    ]);
  });
});
