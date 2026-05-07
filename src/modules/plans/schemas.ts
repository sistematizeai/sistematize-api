export const createPlanSchema = {
  body: {
    type: 'object',
    required: ['name', 'price_monthly', 'price_yearly', 'max_collaborators', 'max_services', 'max_appointments_month'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      price_monthly: { type: 'number', minimum: 0 },
      price_yearly: { type: 'number', minimum: 0 },
      max_collaborators: { type: 'integer', minimum: 1 },
      max_services: { type: 'integer', minimum: 1 },
      max_appointments_month: { type: 'integer', minimum: 1 },
    },
  },
} as const;

export const updatePlanSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      price_monthly: { type: 'number', minimum: 0 },
      price_yearly: { type: 'number', minimum: 0 },
      max_collaborators: { type: 'integer', minimum: 1 },
      max_services: { type: 'integer', minimum: 1 },
      max_appointments_month: { type: 'integer', minimum: 1 },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
