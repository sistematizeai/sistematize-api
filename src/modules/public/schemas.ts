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
    required: ['client_name', 'client_phone', 'service_id', 'date', 'start_time'],
    properties: {
      client_name: { type: 'string', minLength: 1, maxLength: 200 },
      client_phone: { type: 'string', minLength: 8, maxLength: 20 },
      service_id: { type: 'string', format: 'uuid' },
      collaborator_id: { type: 'string', format: 'uuid' },
      date: { type: 'string', format: 'date' },
      start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      notes: { type: 'string', maxLength: 500 },
    },
  },
  params: {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string' } },
  },
} as const;
