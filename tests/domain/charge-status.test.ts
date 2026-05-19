import { describe, it, expect } from 'vitest';
import { statusForCharge } from '@/server/domain/charge-status';

describe('statusForCharge', () => {
  it('is open when nothing allocated', () => {
    expect(statusForCharge({ amount: 100, allocated: 0, cancelled: false })).toBe('open');
  });

  it('is open when partial', () => {
    expect(statusForCharge({ amount: 100, allocated: 40, cancelled: false })).toBe('open');
  });

  it('is paid when fully allocated', () => {
    expect(statusForCharge({ amount: 100, allocated: 100, cancelled: false })).toBe('paid');
  });

  it('stays paid even if overallocated (defensive)', () => {
    expect(statusForCharge({ amount: 100, allocated: 150, cancelled: false })).toBe('paid');
  });

  it('returns cancelled when cancelled flag set', () => {
    expect(statusForCharge({ amount: 100, allocated: 50, cancelled: true })).toBe('cancelled');
  });
});
