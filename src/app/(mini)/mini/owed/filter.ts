export type ChargeStatus = 'open' | 'paid' | 'cancelled';

export function parseChargesStatusParam(value: unknown): ChargeStatus | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === 'open' || value === 'paid' || value === 'cancelled') return value;
  return undefined;
}
