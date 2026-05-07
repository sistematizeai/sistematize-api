import { TOTP, Secret } from 'otpauth';

export function generateTOTPSecret(): string {
  const secret = new Secret();
  return secret.base32;
}

export function verifyTOTPToken(token: string, secretBase32: string): boolean {
  try {
    const totp = new TOTP({ secret: Secret.fromBase32(secretBase32) });
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
