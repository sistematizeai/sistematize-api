export const slugParamsSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string', minLength: 1, maxLength: 100 } },
  },
} as const;

export const publicBookingSchema = {
  body: {
    type: 'object',
    required: ['client_name', 'client_phone', 'date', 'start_time'],
    additionalProperties: false,
    properties: {
      client_name: { type: 'string', minLength: 1, maxLength: 200 },
      client_phone: { type: 'string', minLength: 10, maxLength: 20, pattern: '^[0-9]+$' },
      service_id: { type: 'string', format: 'uuid' },
      combo_id: { type: 'string', format: 'uuid' },
      collaborator_id: { type: 'string', format: 'uuid' },
      date: { type: 'string', format: 'date' },
      start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      notes: { type: 'string', maxLength: 500 },
      client_email: { type: 'string', format: 'email', maxLength: 200 },
    },
  },
  params: {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string' } },
  },
} as const;
