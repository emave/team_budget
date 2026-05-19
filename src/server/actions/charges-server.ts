'use server';

import {
  createAdhocCharge as a,
  createPotBorrow as p,
  createSplitCharge as s,
  cancelCharge as c,
} from './charges';

export async function createAdhocCharge(input: unknown) {
  return a(input as never);
}

export async function createPotBorrow(input: unknown) {
  return p(input as never);
}

export async function createSplitCharge(input: unknown) {
  return s(input as never);
}

export async function cancelCharge(input: { id: string }) {
  return c(input);
}
