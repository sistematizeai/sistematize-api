export const createModuleSchema = {
  body: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 50 },
      slug: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-z0-9-]+$' },
      description: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const updateModuleSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      is_active: { type: 'boolean' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const linkModuleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['module_id'],
    properties: { module_id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const userModuleOverrideSchema = {
  body: {
    type: 'object',
    required: ['profile_id', 'module_id', 'business_id'],
    properties: {
      profile_id: { type: 'string', format: 'uuid' },
      module_id: { type: 'string', format: 'uuid' },
      business_id: { type: 'string', format: 'uuid' },
      is_active: { type: 'boolean' },
    },
  },
} as const;
