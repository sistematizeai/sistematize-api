import { TOTP, Secret } from 'otpauth';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { loadEnv } from '../config/env.js';

function getEncryptionKey(): Buffer {
  const env = loadEnv();
  const key = Buffer.from(env.TOTP_ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

function resolveSecret(stored: string): string {
  if (stored.length === 32 && /^[A-Z2-7]+$/.test(stored)) {
    return stored;
  }
  return decryptSecret(stored);
}

export function generateTOTPSecret(): string {
  const secret = new Secret();
  return secret.base32;
}

export function verifyTOTPToken(token: string, storedSecret: string): boolean {
  try {
    const base32 = resolveSecret(storedSecret);
    const totp = new TOTP({ secret: Secret.fromBase32(base32) });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

export function generateQRCodeURL(secretBase32: string, email: string, issuer: string): string {
  const totp = new TOTP({
    issuer,
    label: email,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}
