export const createCategorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      icon: { type: 'string', maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      sort_order: { type: 'integer', minimum: 0 },
    },
  },
} as const;

export const updateCategorySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      icon: { type: 'string', maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      sort_order: { type: 'integer', minimum: 0 },
      is_active: { type: 'boolean' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const categoryParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
