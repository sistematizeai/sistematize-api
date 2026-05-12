export const createServiceSchema = {
  body: {
    type: 'object',
    required: ['name', 'category_id'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      category_id: { type: 'string', format: 'uuid' },
      description: { type: 'string', maxLength: 1000 },
      price: { type: 'number', minimum: 0 },
      price_type: { type: 'string', enum: ['fixed', 'starting_at', 'on_request'] },
      duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
      is_active: { type: 'boolean' },
      sort_order: { type: 'integer', minimum: 0 },
      requires_payment: { type: 'boolean' },
      payment_type: { type: 'string', enum: ['none', 'deposit', 'full_payment', 'manual'] },
      deposit_amount: { type: 'number', minimum: 0 },
    },
  },
} as const;

export const updateServiceSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      category_id: { type: 'string', format: 'uuid' },
      description: { type: 'string', maxLength: 1000 },
      price: { type: 'number', minimum: 0 },
      price_type: { type: 'string', enum: ['fixed', 'starting_at', 'on_request'] },
      duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
      is_active: { type: 'boolean' },
      sort_order: { type: 'integer', minimum: 0 },
      requires_payment: { type: 'boolean' },
      payment_type: { type: 'string', enum: ['none', 'deposit', 'full_payment', 'manual'] },
      deposit_amount: { type: 'number', minimum: 0 },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const serviceParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
