export const registerSchema = {
  body: {
    type: 'object',
    required: [
      'full_name', 'email', 'password', 'document',
      'business_name', 'segment', 'business_type', 'city', 'state', 'whatsapp',
      'professionals_count', 'monthly_appointments_range', 'current_scheduling_method',
      'current_system_usage', 'main_difficulty',
      'monthly_revenue_range', 'main_goal', 'whatsapp_automation_interest',
      'public_booking_page_interest', 'digital_catalog_interest', 'best_contact_time',
      'accepted_terms',
    ],
    additionalProperties: false,
    properties: {
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128, pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$' },
      document: { type: 'string', minLength: 11, maxLength: 18 },
      business_name: { type: 'string', minLength: 2, maxLength: 100 },
      segment: { type: 'string', minLength: 1, maxLength: 100 },
      business_type: { type: 'string', minLength: 1, maxLength: 100 },
      city: { type: 'string', minLength: 1, maxLength: 100 },
      state: { type: 'string', minLength: 2, maxLength: 2 },
      whatsapp: { type: 'string', minLength: 10, maxLength: 20 },
      instagram: { type: 'string', maxLength: 100, default: '' },
      professionals_count: { type: 'string', minLength: 1 },
      monthly_appointments_range: { type: 'string', minLength: 1 },
      current_scheduling_method: { type: 'string', minLength: 1 },
      current_system_usage: { type: 'string', minLength: 1 },
      main_difficulty: { type: 'string', minLength: 1 },
      monthly_revenue_range: { type: 'string', minLength: 1 },
      main_goal: { type: 'string', minLength: 1 },
      whatsapp_automation_interest: { type: 'string', minLength: 1 },
      public_booking_page_interest: { type: 'string', minLength: 1 },
      digital_catalog_interest: { type: 'string', minLength: 1 },
      best_contact_time: { type: 'string', minLength: 1 },
      accepted_terms: { type: 'boolean', enum: [true] },
      accepted_marketing: { type: 'boolean', default: false },
    },
  },
} as const;

export const resendConfirmationSchema = {
  body: {
    type: 'object',
    required: ['email'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
    },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
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
    additionalProperties: false,
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
    additionalProperties: false,
    properties: {
      totp_code: { type: 'string', minLength: 6, maxLength: 6 },
    },
  },
} as const;

export const confirmEmailSchema = {
  body: {
    type: 'object',
    required: ['token'],
    additionalProperties: false,
    properties: {
      token: { type: 'string' },
    },
  },
} as const;

export const completeRegistrationSchema = {
  body: {
    type: 'object',
    required: ['document', 'business_name'],
    additionalProperties: false,
    properties: {
      document: { type: 'string', minLength: 11, maxLength: 18 },
      business_name: { type: 'string', minLength: 2, maxLength: 100 },
      full_name: { type: 'string', minLength: 2, maxLength: 100 },
    },
  },
} as const;
