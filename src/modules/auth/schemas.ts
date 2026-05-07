export const registerSchema = {
  body: {
    type: 'object',
    required: ['full_name', 'email', 'password', 'document', 'business_name'],
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      document: { type: 'string', minLength: 11, maxLength: 18 },
      business_name: { type: 'string', minLength: 2, maxLength: 100 },
    },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
} as const;

export const verify2FASchema = {
  body: {
    type: 'object',
    required: ['temp_token', 'totp_code'],
    properties: {
      temp_token: { type: 'string' },
      totp_code: { type: 'string', minLength: 6, maxLength: 6 },
    },
  },
} as const;

export const confirm2FASchema = {
  body: {
    type: 'object',
    required: ['totp_code'],
    properties: {
      totp_code: { type: 'string', minLength: 6, maxLength: 6 },
    },
  },
} as const;

export const completeRegistrationSchema = {
  body: {
    type: 'object',
    required: ['document', 'business_name'],
    properties: {
      document: { type: 'string', minLength: 11, maxLength: 18 },
      business_name: { type: 'string', minLength: 2, maxLength: 100 },
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
    },
  },
} as const;
