export const createComboSchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 1000 },
      price: { type: 'number', minimum: 0 },
      discount_percent: { type: 'number', minimum: 0, maximum: 100 },
      duration_minutes: { type: 'integer', minimum: 1, maximum: 480 },
      is_active: { type: 'boolean' },
      sort_order: { type: 'integer', minimum: 0 },
      service_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
      },
    },
  },
} as const;

export const updateComboSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 1000 },
      price: { type: 'number', minimum: 0 },
      discount_percent: { type: 'number', minimum: 0, maximum: 100 },
      duration_minutes: { type: 'integer', minimum: 1, maximum: 480 },
      is_active: { type: 'boolean' },
      sort_order: { type: 'integer', minimum: 0 },
      service_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
      },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const comboParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
