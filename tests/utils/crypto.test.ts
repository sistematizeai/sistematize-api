import { describe, it, expect } from 'vitest';

describe('Crypto Utils', () => {
  it('encrypt and decrypt roundtrip', async () => {
    const { encrypt, decrypt } = await import('../../src/utils/crypto.js');
    const plaintext = 'sk_test_abc123_sensitive_api_key';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).not.toContain(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypt produces different ciphertext each time (random IV)', async () => {
    const { encrypt } = await import('../../src/utils/crypto.js');
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('generateWebhookToken produces 96-char hex string', async () => {
    const { generateWebhookToken } = await import('../../src/utils/crypto.js');
    const token = generateWebhookToken();
    expect(token).toHaveLength(96);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('decrypt fails with tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('../../src/utils/crypto.js');
    const encrypted = encrypt('secret');
    const tampered = encrypted.slice(0, -2) + 'XX';
    expect(() => decrypt(tampered)).toThrow();
  });
});
