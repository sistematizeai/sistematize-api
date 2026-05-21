const INTERNAL_ROLES = ['sub_admin', 'support', 'finance', 'commercial', 'technical'] as const;
const ALL_ROLES = ['master_admin', ...INTERNAL_ROLES, 'owner', 'collaborator'] as const;
const PERMISSIONS = [
  'businesses.read',
  'businesses.write',
  'users.read',
  'users.write',
  'finance.read',
  'finance.write',
  'support.read',
  'support.write',
  'technical.read',
  'technical.write',
] as const;

export const updateProfileSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
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
    additionalProperties: false,
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: 'string', maxLength: 20 },
      role: { type: 'string', enum: ALL_ROLES },
      is_active: { type: 'boolean' },
      permissions: {
        type: 'array',
        items: { type: 'string', enum: PERMISSIONS },
        uniqueItems: true,
      },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const createInternalUserSchema = {
  body: {
    type: 'object',
    required: ['full_name', 'email', 'role', 'permissions'],
    additionalProperties: false,
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', maxLength: 20 },
      role: { type: 'string', enum: INTERNAL_ROLES },
      permissions: {
        type: 'array',
        items: { type: 'string', enum: PERMISSIONS },
        uniqueItems: true,
      },
      is_active: { type: 'boolean' },
    },
  },
} as const;

export const profileParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const updateProfileStatusSchema = {
  body: {
    type: 'object',
    required: ['is_active'],
    additionalProperties: false,
    properties: {
      is_active: { type: 'boolean' },
    },
  },
  params: profileParamsSchema.params,
} as const;
