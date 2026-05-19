import { describe, it, expect } from 'vitest';
import { formatCents, parseDollarsToCents } from '@/shared/format';

describe('formatCents', () => {
  it('formats USD with sign', () => {
    expect(formatCents(12345, 'USD')).toBe('$123.45');
    expect(formatCents(0, 'USD')).toBe('$0.00');
    expect(formatCents(-50, 'USD')).toBe('-$0.50');
  });

  it('falls back to code for unknown currency', () => {
    expect(formatCents(100, 'BYN')).toBe('BYN 1.00');
  });
});

describe('parseDollarsToCents', () => {
  it('parses common forms', () => {
    expect(parseDollarsToCents('1.23')).toBe(123);
    expect(parseDollarsToCents('100')).toBe(10000);
  });
  it('rejects invalid', () => {
    expect(() => parseDollarsToCents('-5')).toThrow();
    expect(() => parseDollarsToCents('1.234')).toThrow();
  });
});
