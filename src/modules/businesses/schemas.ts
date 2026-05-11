export const updateBusinessSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: ['string', 'null'], maxLength: 20 },
      whatsapp: { type: ['string', 'null'], maxLength: 20 },
      address: { type: ['string', 'null'], maxLength: 255 },
      city: { type: ['string', 'null'], maxLength: 100 },
      state: { type: ['string', 'null'], maxLength: 2 },
      cep: { type: ['string', 'null'], maxLength: 10 },
      cnpj: { type: ['string', 'null'], maxLength: 20 },
      description: { type: ['string', 'null'], maxLength: 500 },
      instagram: { type: ['string', 'null'], maxLength: 100 },
      facebook: { type: ['string', 'null'], maxLength: 100 },
      tiktok: { type: ['string', 'null'], maxLength: 100 },
      cover_image_url: { type: ['string', 'null'] },
      welcome_message: { type: ['string', 'null'], maxLength: 300 },
      primary_color: { type: ['string', 'null'], maxLength: 10 },
      cancellation_policy: { type: ['string', 'null'], maxLength: 1000 },
      booking_enabled: { type: 'boolean' },
      booking_settings: { type: 'object' },
      notification_settings: { type: 'object' },
      business_hours: { type: 'object' },
      logo_url: { type: ['string', 'null'] },
    },
  },
} as const;

export const adminUpdateBusinessSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      phone: { type: ['string', 'null'], maxLength: 20 },
      whatsapp: { type: ['string', 'null'], maxLength: 20 },
      address: { type: ['string', 'null'], maxLength: 255 },
      city: { type: ['string', 'null'], maxLength: 100 },
      state: { type: ['string', 'null'], maxLength: 2 },
      cep: { type: ['string', 'null'], maxLength: 10 },
      cnpj: { type: ['string', 'null'], maxLength: 20 },
      description: { type: ['string', 'null'], maxLength: 500 },
      plan_id: { type: ['string', 'null'], format: 'uuid' },
      trial_ends_at: { type: ['string', 'null'] },
      is_active: { type: 'boolean' },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;

export const updateStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['trial', 'active', 'paid', 'overdue', 'cancelled', 'blocked'] },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
} as const;
