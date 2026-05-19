export type Cents = number;

export function parseAmount(input: string | number): Cents {
  const str = typeof input === 'number' ? String(input) : input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`invalid amount: ${input}`);
  }
  const [whole, frac = ''] = str.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isFinite(cents) || cents < 0) throw new Error(`invalid amount: ${input}`);
  return cents;
}

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function formatAmount(cents: Cents, currency: string): string {
  const sym = SYMBOL[currency] ?? `${currency} `;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${sym}${dollars}.${remainder.toString().padStart(2, '0')}`;
}
