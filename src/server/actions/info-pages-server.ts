'use server';

import {
  upsertInfoPage as u,
  reorderInfoPages as r,
  deleteInfoPage as d,
} from './info-pages';

export async function upsertInfoPage(input: unknown) {
  return u(input as never);
}
export async function reorderInfoPages(input: { orderedIds: string[] }) {
  return r(input);
}
export async function deleteInfoPage(input: { id: string }) {
  return d(input);
}
