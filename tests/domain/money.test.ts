import { describe, it, expect } from 'vitest';
import { parseAmount, formatAmount } from '@/server/domain/money';

describe('money', () => {
  it('parses dollars to cents', () => {
    expect(parseAmount('1.23')).toBe(123);
    expect(parseAmount('100')).toBe(10000);
    expect(parseAmount('0.50')).toBe(50);
  });

  it('rejects negatives by default', () => {
    expect(() => parseAmount('-1')).toThrow();
  });

  it('rejects too many decimal places', () => {
    expect(() => parseAmount('1.234')).toThrow();
  });

  it('formats cents to a display string', () => {
    expect(formatAmount(123, 'USD')).toBe('$1.23');
    expect(formatAmount(10000, 'USD')).toBe('$100.00');
  });
});
