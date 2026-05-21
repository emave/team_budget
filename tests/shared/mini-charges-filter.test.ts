import { describe, it, expect } from 'vitest';
import { parseChargesStatusParam } from '@/app/(mini)/mini/charges/filter';

describe('parseChargesStatusParam', () => {
  it('returns undefined for nullish / "all"', () => {
    expect(parseChargesStatusParam(undefined)).toBeUndefined();
    expect(parseChargesStatusParam(null)).toBeUndefined();
    expect(parseChargesStatusParam('all')).toBeUndefined();
    expect(parseChargesStatusParam('')).toBeUndefined();
  });

  it('returns the value for known statuses', () => {
    expect(parseChargesStatusParam('open')).toBe('open');
    expect(parseChargesStatusParam('paid')).toBe('paid');
    expect(parseChargesStatusParam('cancelled')).toBe('cancelled');
  });

  it('returns undefined for unknown values', () => {
    expect(parseChargesStatusParam('foo')).toBeUndefined();
    expect(parseChargesStatusParam(42)).toBeUndefined();
    expect(parseChargesStatusParam(['open'])).toBeUndefined();
  });
});
