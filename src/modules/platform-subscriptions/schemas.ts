export const subscribeSchema = {
  body: {
    type: 'object' as const,
    required: ['plan_id', 'billing_cycle'],
    properties: {
      plan_id: { type: 'string', format: 'uuid' },
      billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
      billing_type: { type: 'string', enum: ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'], default: 'UNDEFINED' },
    },
    additionalProperties: false,
  },
};

export const upgradeSchema = {
  body: {
    type: 'object' as const,
    required: ['plan_id'],
    properties: {
      plan_id: { type: 'string', format: 'uuid' },
      billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
      billing_type: { type: 'string', enum: ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'], default: 'UNDEFINED' },
    },
    additionalProperties: false,
  },
};
