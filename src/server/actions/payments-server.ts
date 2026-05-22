'use server';

import {
  recordPayment as r,
  cancelPayment as c,
  listOpenChargesForPayer as l,
} from './payments';

export async function recordPayment(input: unknown) {
  return r(input as never);
}
export async function cancelPayment(input: { id: string }) {
  return c(input);
}
export async function listOpenChargesForPayer(input: { payerUserId: string }) {
  return l(input as never);
}
