export type ChargeStatus = 'open' | 'paid' | 'cancelled';

export interface StatusInput {
  amount: number;
  allocated: number;
  cancelled: boolean;
}

export function statusForCharge(input: StatusInput): ChargeStatus {
  if (input.cancelled) return 'cancelled';
  return input.allocated >= input.amount ? 'paid' : 'open';
}
