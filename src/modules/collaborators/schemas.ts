export const createCollaboratorSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      phone: { type: 'string', maxLength: 20 },
      email: { type: 'string', format: 'email', maxLength: 200 },
      cpf: { type: 'string', maxLength: 14 },
      birth_date: { type: 'string', format: 'date' },
      address: { type: 'string', maxLength: 500 },
      base_commission: { type: 'number', minimum: 0, maximum: 100 },
      work_start: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      work_end: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      notes: { type: 'string', maxLength: 2000 },
      is_active: { type: 'boolean' },
    },
  },
} as const;

export const updateCollaboratorSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      phone: { type: 'string', maxLength: 20 },
      email: { type: 'string', format: 'email', maxLength: 200 },
      cpf: { type: 'string', maxLength: 14 },
      birth_date: { type: 'string', format: 'date' },
      address: { type: 'string', maxLength: 500 },
      base_commission: { type: 'number', minimum: 0, maximum: 100 },
      work_start: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      work_end: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
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

export const collaboratorParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const updateCollaboratorServicesSchema = {
  body: {
    type: 'object',
    required: ['services'],
    properties: {
      services: {
        type: 'array',
        items: {
          type: 'object',
          required: ['service_id'],
          properties: {
            service_id: { type: 'string', format: 'uuid' },
            commission: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
