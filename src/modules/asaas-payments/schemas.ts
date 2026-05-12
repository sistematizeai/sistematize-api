export const createAsaasCustomerSchema = {
  body: {
    type: 'object',
    required: ['clientId'],
    additionalProperties: false,
    properties: {
      clientId: { type: 'string', format: 'uuid' },
    },
  },
} as const;

export const createPaymentSchema = {
  body: {
    type: 'object',
    required: ['clientId', 'value', 'dueDate', 'billingType'],
    additionalProperties: false,
    properties: {
      clientId: { type: 'string', format: 'uuid' },
      appointmentId: { type: 'string', format: 'uuid' },
      value: { type: 'number', exclusiveMinimum: 0 },
      dueDate: { type: 'string', format: 'date' },
      billingType: { type: 'string', enum: ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'] },
      description: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export const listPaymentsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      billing_type: { type: 'string' },
      date_from: { type: 'string', format: 'date' },
      date_to: { type: 'string', format: 'date' },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
} as const;

export const paymentParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
