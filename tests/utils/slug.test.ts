import { describe, it, expect } from 'vitest';
import { generateSlug } from '../../src/utils/slug.js';

describe('generateSlug', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(generateSlug('Salao da Maria')).toBe('salao-da-maria');
  });
  it('removes accents', () => {
    expect(generateSlug('Estetica Belissima')).toBe('estetica-belissima');
  });
  it('removes special characters', () => {
    expect(generateSlug('Beauty & Hair Studio!')).toBe('beauty-hair-studio');
  });
  it('collapses multiple hyphens', () => {
    expect(generateSlug('Salao  --  Top')).toBe('salao-top');
  });
  it('trims leading and trailing hyphens', () => {
    expect(generateSlug(' -Salao- ')).toBe('salao');
  });
});
