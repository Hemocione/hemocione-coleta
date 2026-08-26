import { describe, it, expect } from 'vitest';
import { isValidCnpj, onlyDigits } from '~/utils/cnpj';

describe('onlyDigits', () => {
  it('strips non-digit characters', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('returns empty string for empty input', () => {
    expect(onlyDigits('')).toBe('');
  });
});

describe('isValidCnpj', () => {
  it('accepts a valid CNPJ with mask', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('accepts a valid CNPJ without mask', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejects a CNPJ with invalid check digits', () => {
    expect(isValidCnpj('12345678901234')).toBe(false);
  });

  it('rejects repeated digits', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
