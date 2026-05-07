export const updateBusinessSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: 'string', maxLength: 20 },
      whatsapp: { type: 'string', maxLength: 20 },
      address: { type: 'string', maxLength: 255 },
      city: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 2 },
      business_hours: { type: 'object' },
      logo_url: { type: 'string' },
    },
  },
} as const;

export const updateStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['trial', 'active', 'paid', 'overdue', 'cancelled', 'blocked'] },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
