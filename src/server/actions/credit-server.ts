'use server';

import {
  recordCreditDeposit as r,
  applyCreditToCharge as a,
  refundCredit as rf,
  transferCredit as t,
  cancelCreditMovement as c,
} from './credit';

export async function recordCreditDeposit(input: unknown) {
  return r(input as never);
}
export async function applyCreditToCharge(input: unknown) {
  return a(input as never);
}
export async function refundCredit(input: unknown) {
  return rf(input as never);
}
export async function transferCredit(input: unknown) {
  return t(input as never);
}
export async function cancelCreditMovement(input: { id: string }) {
  return c(input);
}
