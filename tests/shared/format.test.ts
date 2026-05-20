import { describe, it, expect } from 'vitest';
import { formatCents, parseDollarsToCents } from '@/shared/format';

describe('formatCents', () => {
  it('renders BYN with suffix', () => {
    expect(formatCents(12345)).toBe('123.45 р.');
    expect(formatCents(0)).toBe('0.00 р.');
    expect(formatCents(100)).toBe('1.00 р.');
  });

  it('preserves sign for negatives', () => {
    expect(formatCents(-50)).toBe('-0.50 р.');
    expect(formatCents(-12345)).toBe('-123.45 р.');
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
