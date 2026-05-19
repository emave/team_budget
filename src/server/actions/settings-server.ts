'use server';

import {
  updateMonthlyDuesAmount as u,
  runDuesNow as r,
} from './settings';

export async function updateMonthlyDuesAmount(input: { amount: number | string }) {
  return u(input);
}
export async function runDuesNow() {
  return r({} as never);
}
