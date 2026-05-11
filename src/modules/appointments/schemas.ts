export const createAppointmentSchema = {
  body: {
    type: 'object',
    required: ['client_id', 'collaborator_id', 'date', 'start_time', 'service_ids'],
    additionalProperties: false,
    properties: {
      client_id: { type: 'string', format: 'uuid' },
      collaborator_id: { type: 'string', format: 'uuid' },
      date: { type: 'string', format: 'date' },
      start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      service_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
      notes: { type: 'string', maxLength: 2000 },
      source: { type: 'string', enum: ['dashboard', 'public_page', 'whatsapp'] },
    },
  },
} as const;

export const updateAppointmentSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      collaborator_id: { type: 'string', format: 'uuid' },
      date: { type: 'string', format: 'date' },
      start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      notes: { type: 'string', maxLength: 2000 },
      payment_method: { type: 'string', enum: ['pix', 'credit', 'debit', 'cash'] },
      cancel_reason: { type: 'string', maxLength: 2000 },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const updateStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const appointmentParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const listAppointmentsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      date: { type: 'string', format: 'date' },
      status: { type: 'string' },
      collaborator_id: { type: 'string', format: 'uuid' },
      date_from: { type: 'string', format: 'date' },
      date_to: { type: 'string', format: 'date' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
} as const;
