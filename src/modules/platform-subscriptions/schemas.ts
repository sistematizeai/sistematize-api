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

export const checkoutInvoiceSchema = {
  params: {
    type: 'object' as const,
    required: ['invoiceId'],
    properties: {
      invoiceId: { type: 'string', format: 'uuid' },
    },
    additionalProperties: false,
  },
};

export const checkoutCardPaymentSchema = {
  params: checkoutInvoiceSchema.params,
  body: {
    type: 'object' as const,
    required: ['credit_card', 'holder_info'],
    properties: {
      credit_card: {
        type: 'object' as const,
        required: ['holder_name', 'number', 'expiry_month', 'expiry_year', 'ccv'],
        properties: {
          holder_name: { type: 'string', minLength: 3, maxLength: 120 },
          number: { type: 'string', minLength: 13, maxLength: 19 },
          expiry_month: { type: 'string', minLength: 1, maxLength: 2 },
          expiry_year: { type: 'string', minLength: 2, maxLength: 4 },
          ccv: { type: 'string', minLength: 3, maxLength: 4 },
        },
        additionalProperties: false,
      },
      holder_info: {
        type: 'object' as const,
        required: ['name', 'email', 'cpf_cnpj', 'postal_code', 'address_number'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 120 },
          email: { type: 'string', format: 'email' },
          cpf_cnpj: { type: 'string', minLength: 11, maxLength: 18 },
          postal_code: { type: 'string', minLength: 8, maxLength: 10 },
          address_number: { type: 'string', minLength: 1, maxLength: 20 },
          phone: { type: 'string', minLength: 8, maxLength: 20 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
};

export const paymentMethodParamsSchema = {
  params: {
    type: 'object' as const,
    required: ['paymentMethodId'],
    properties: {
      paymentMethodId: { type: 'string', format: 'uuid' },
    },
    additionalProperties: false,
  },
};

export const checkoutSavedCardPaymentSchema = {
  params: checkoutInvoiceSchema.params,
};
