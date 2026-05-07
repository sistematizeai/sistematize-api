import { describe, it, expect } from 'vitest';
import { validateCPF, validateCNPJ, detectDocumentType, sanitizeDocument, validateDocument } from '../../src/utils/document.js';

describe('sanitizeDocument', () => {
  it('removes dots, dashes and slashes', () => {
    expect(sanitizeDocument('123.456.789-09')).toBe('12345678909');
    expect(sanitizeDocument('12.345.678/0001-95')).toBe('12345678000195');
  });
});

describe('detectDocumentType', () => {
  it('returns cpf for 11 digits', () => {
    expect(detectDocumentType('12345678909')).toBe('cpf');
  });
  it('returns cnpj for 14 digits', () => {
    expect(detectDocumentType('12345678000195')).toBe('cnpj');
  });
  it('returns null for invalid length', () => {
    expect(detectDocumentType('12345')).toBeNull();
  });
});

describe('validateCPF', () => {
  it('returns true for valid CPF', () => {
    expect(validateCPF('52998224725')).toBe(true);
  });
  it('returns false for all same digits', () => {
    expect(validateCPF('11111111111')).toBe(false);
  });
  it('returns false for invalid check digits', () => {
    expect(validateCPF('52998224720')).toBe(false);
  });
  it('returns false for wrong length', () => {
    expect(validateCPF('1234')).toBe(false);
  });
});

describe('validateCNPJ', () => {
  it('returns true for valid CNPJ', () => {
    expect(validateCNPJ('11222333000181')).toBe(true);
  });
  it('returns false for all same digits', () => {
    expect(validateCNPJ('11111111111111')).toBe(false);
  });
  it('returns false for invalid check digits', () => {
    expect(validateCNPJ('11222333000180')).toBe(false);
  });
  it('returns false for wrong length', () => {
    expect(validateCNPJ('1234')).toBe(false);
  });
});

describe('validateDocument', () => {
  it('validates a complete CPF flow', () => {
    const result = validateDocument('529.982.247-25');
    expect(result).toEqual({ valid: true, type: 'cpf', clean: '52998224725' });
  });
  it('validates a complete CNPJ flow', () => {
    const result = validateDocument('11.222.333/0001-81');
    expect(result).toEqual({ valid: true, type: 'cnpj', clean: '11222333000181' });
  });
  it('returns invalid for bad length', () => {
    const result = validateDocument('12345');
    expect(result).toEqual({ valid: false, type: null, clean: '12345' });
  });
});
