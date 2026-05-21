export const MAX_RANGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDay(s: string): Date | null {
  if (!ISO_DAY_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eachDayBetween(from: string, to: string): string[] {
  const start = parseIsoDay(from);
  const end = parseIsoDay(to);
  if (!start || !end) return [];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    out.push(isoDay(new Date(t)));
  }
  return out;
}

export interface ResolvedRange {
  from: string;
  to: string;
  clamped: boolean;
}

function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function resolveDashboardRange(
  input: { from?: string; to?: string },
  now: Date = new Date(),
): ResolvedRange {
  const defaultTo = isoDay(now);
  const defaultFrom = isoDay(firstOfMonth(now));

  const fromParsed = input.from ? parseIsoDay(input.from) : null;
  const toParsed = input.to ? parseIsoDay(input.to) : null;
  if (!fromParsed || !toParsed) {
    return { from: defaultFrom, to: defaultTo, clamped: false };
  }

  let from = fromParsed;
  let to = toParsed;
  if (from.getTime() > to.getTime()) [from, to] = [to, from];

  const spanDays = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    const clampedFrom = new Date(to.getTime() - (MAX_RANGE_DAYS - 1) * DAY_MS);
    return { from: isoDay(clampedFrom), to: isoDay(to), clamped: true };
  }
  return { from: isoDay(from), to: isoDay(to), clamped: false };
}
