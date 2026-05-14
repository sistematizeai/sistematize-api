import { describe, expect, it } from 'vitest';
import { registerSchema } from '../../src/modules/auth/schemas.js';

describe('Auth register schema', () => {
  it('requires CPF/CNPJ document in email registration', () => {
    expect(registerSchema.body.required).toContain('document');
    expect(registerSchema.body.properties).toHaveProperty('document');
  });
});
