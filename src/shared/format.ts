export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${whole}.${rem.toString().padStart(2, '0')} р.`;
}

export function parseDollarsToCents(input: string): number {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`invalid amount: ${input}`);
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
