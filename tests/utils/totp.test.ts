import { describe, it, expect } from 'vitest';
import { TOTP, Secret } from 'otpauth';
import { generateTOTPSecret, verifyTOTPToken, generateQRCodeURL } from '../../src/utils/totp.js';

describe('TOTP', () => {
  it('generates a secret with correct format', () => {
    const secret = generateTOTPSecret();
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(10);
  });

  it('generates a valid QR code URL', () => {
    const url = generateQRCodeURL('JBSWY3DPEHPK3PXP', 'user@test.com', 'Sistematize');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('Sistematize');
    expect(url).toContain('user%40test.com');
  });

  it('verifies a valid token', () => {
    const secretBase32 = generateTOTPSecret();
    const totp = new TOTP({ secret: Secret.fromBase32(secretBase32) });
    const token = totp.generate();
    expect(verifyTOTPToken(token, secretBase32)).toBe(true);
  });

  it('rejects an invalid token', () => {
    const secretBase32 = generateTOTPSecret();
    expect(verifyTOTPToken('000000', secretBase32)).toBe(false);
  });
});
