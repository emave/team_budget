'use server';

import {
  recordSpending as r,
  cancelSpending as c,
} from './spendings';

export async function recordSpending(input: unknown) {
  return r(input as never);
}
export async function cancelSpending(input: { id: string }) {
  return c(input);
}
