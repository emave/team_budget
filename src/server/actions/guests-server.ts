'use server';

import {
  createGuest as a,
  renameGuest as b,
  archiveGuest as c,
  unarchiveGuest as d,
  listGuests as e,
} from './guests';

export async function createGuest(input: unknown) { return a(input as never); }
export async function renameGuest(input: unknown) { return b(input as never); }
export async function archiveGuest(input: { id: string }) { return c(input); }
export async function unarchiveGuest(input: { id: string }) { return d(input); }
export async function listGuests(input?: { includeArchived?: boolean }) { return e(input); }
