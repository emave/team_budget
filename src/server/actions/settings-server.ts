'use server';

import {
  updateMonthlyDuesAmount as u,
  runDuesNow as r,
  updatePotOpenings as p,
} from './settings';

export async function updateMonthlyDuesAmount(input: { amount: number | string }) {
  return u(input);
}
export async function runDuesNow() {
  return r({} as never);
}
export async function updatePotOpenings(input: { cashCents: number | string; cardCents: number | string }) {
  return p(input);
}
