export const listAuditSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'string' },
      limit: { type: 'string' },
      entity_type: { type: 'string' },
      action: { type: 'string' },
    },
  },
} as const;
