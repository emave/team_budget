'use server';

import {
  recordGuestDeposit as a,
  cancelGuestDeposit as b,
  guestDepositSummary as c,
  listGuestDeposits as d,
} from './guest-deposits';

export async function recordGuestDeposit(input: unknown) { return a(input as never); }
export async function cancelGuestDeposit(input: { id: string }) { return b(input); }
export async function guestDepositSummary(input: { from: string; to: string }) { return c(input); }
export async function listGuestDeposits(input?: { guestId?: string | null }) { return d(input); }
