const uuid = { type: 'string', format: 'uuid' } as const;

export const createManualIncomeSchema = {
  body: {
    type: 'object',
    required: ['amount', 'payment_method', 'occurred_on'],
    additionalProperties: false,
    properties: {
      amount: { type: 'number', exclusiveMinimum: 0 },
      payment_method: { type: 'string', enum: ['pix', 'credit', 'debit', 'cash', 'external'] },
      occurred_on: { type: 'string', format: 'date' },
      status: { type: 'string', enum: ['received', 'pending'], default: 'received' },
      appointment_id: uuid,
      client_id: uuid,
      collaborator_id: uuid,
      service_id: uuid,
      description: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const listFinancialRecordsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      date_from: { type: 'string', format: 'date' },
      date_to: { type: 'string', format: 'date' },
      payment_method: { type: 'string' },
      status: { type: 'string' },
      source: { type: 'string' },
      collaborator_id: uuid,
      service_id: uuid,
      client_id: uuid,
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 1000 },
    },
  },
} as const;
