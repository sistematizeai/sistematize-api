export const connectAsaasSchema = {
  body: {
    type: 'object',
    required: ['apiKey', 'environment'],
    additionalProperties: false,
    properties: {
      apiKey: { type: 'string', minLength: 20 },
      environment: { type: 'string', enum: ['sandbox', 'production'] },
    },
  },
} as const;
