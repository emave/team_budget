'use server';

import {
  recordPayment as r,
  cancelPayment as c,
  suggestFifoAllocation as s,
} from './payments';

export async function recordPayment(input: unknown) {
  return r(input as never);
}
export async function cancelPayment(input: { id: string }) {
  return c(input);
}
export async function suggestFifoAllocation(input: unknown) {
  return s(input as never);
}
