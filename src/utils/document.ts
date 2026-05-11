export function sanitizeDocument(doc: string): string {
  return doc.trim().replace(/[^0-9]/g, '');
}

export function detectDocumentType(doc: string): 'cpf' | 'cnpj' | null {
  const clean = sanitizeDocument(doc);
  if (clean.length === 11) return 'cpf';
  if (clean.length === 14) return 'cnpj';
  return null;
}

export function validateCPF(cpf: string): boolean {
  const clean = sanitizeDocument(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  const digits = clean.split('').map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== digits[10]) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const clean = sanitizeDocument(cnpj);
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const digits = clean.split('').map(Number);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (check1 !== digits[12]) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += digits[i] * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  if (check2 !== digits[13]) return false;

  return true;
}

export function validateDocument(doc: string): { valid: boolean; type: 'cpf' | 'cnpj' | null; clean: string } {
  const clean = sanitizeDocument(doc);
  const type = detectDocumentType(clean);
  if (!type) return { valid: false, type: null, clean };

  const valid = type === 'cpf' ? validateCPF(clean) : validateCNPJ(clean);
  return { valid, type, clean };
}
