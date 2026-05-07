export const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: 'string', maxLength: 20 },
      avatar_url: { type: 'string', format: 'uri' },
    },
  },
} as const;

export const adminUpdateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: 'string', maxLength: 20 },
      role: { type: 'string', enum: ['master_admin', 'sub_admin', 'owner', 'collaborator'] },
      is_active: { type: 'boolean' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
