import { describe, it, expect } from 'vitest';
import { isoDay, eachDayBetween, resolveDashboardRange, MAX_RANGE_DAYS } from '@/shared/date-range';

describe('isoDay', () => {
  it('formats a Date as YYYY-MM-DD in UTC', () => {
    expect(isoDay(new Date('2026-05-21T12:34:56.000Z'))).toBe('2026-05-21');
  });
});

describe('eachDayBetween', () => {
  it('returns inclusive list of YYYY-MM-DD strings', () => {
    expect(eachDayBetween('2026-05-29', '2026-06-02')).toEqual([
      '2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
    ]);
  });
  it('returns single day when from == to', () => {
    expect(eachDayBetween('2026-05-21', '2026-05-21')).toEqual(['2026-05-21']);
  });
});

describe('resolveDashboardRange', () => {
  const today = new Date('2026-05-21T12:00:00.000Z');

  it('defaults to 1st of current month → today when params absent', () => {
    expect(resolveDashboardRange({}, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
  });

  it('parses valid YYYY-MM-DD inputs', () => {
    expect(resolveDashboardRange({ from: '2026-04-10', to: '2026-04-20' }, today)).toEqual({
      from: '2026-04-10', to: '2026-04-20', clamped: false,
    });
  });

  it('falls back to defaults on malformed inputs', () => {
    expect(resolveDashboardRange({ from: 'bogus', to: '2026-04-20' }, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
    expect(resolveDashboardRange({ from: '2026/04/10' }, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
  });

  it('swaps from/to when reversed', () => {
    expect(resolveDashboardRange({ from: '2026-04-20', to: '2026-04-10' }, today)).toEqual({
      from: '2026-04-10', to: '2026-04-20', clamped: false,
    });
  });

  it('clamps ranges wider than MAX_RANGE_DAYS by narrowing `from`', () => {
    const out = resolveDashboardRange({ from: '2025-01-01', to: '2026-05-21' }, today);
    expect(out.to).toBe('2026-05-21');
    expect(out.clamped).toBe(true);
    expect(eachDayBetween(out.from, out.to).length).toBe(MAX_RANGE_DAYS);
  });

  it('MAX_RANGE_DAYS is 90', () => {
    expect(MAX_RANGE_DAYS).toBe(90);
  });
});
