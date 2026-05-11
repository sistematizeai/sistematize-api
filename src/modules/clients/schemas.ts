export const createClientSchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      phone: { type: 'string', maxLength: 20 },
      email: { type: 'string', format: 'email', maxLength: 200 },
      birth_date: { type: 'string', format: 'date' },
      source: { type: 'string', enum: ['instagram', 'google', 'referral', 'public_page', 'manual', 'other'] },
      notes: { type: 'string', maxLength: 2000 },
    },
  },
} as const;

export const updateClientSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      phone: { type: 'string', maxLength: 20 },
      email: { type: 'string', format: 'email', maxLength: 200 },
      birth_date: { type: 'string', format: 'date' },
      source: { type: 'string', enum: ['instagram', 'google', 'referral', 'public_page', 'manual', 'other'] },
      notes: { type: 'string', maxLength: 2000 },
      is_active: { type: 'boolean' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const clientParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const listClientsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', maxLength: 100 },
    },
  },
} as const;
