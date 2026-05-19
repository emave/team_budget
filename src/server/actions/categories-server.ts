'use server';

import {
  upsertCategory as u,
  archiveCategory as a,
} from './categories';

export async function upsertCategory(input: { id?: string; name: string }) {
  return u(input);
}
export async function archiveCategory(input: { id: string }) {
  return a(input);
}
