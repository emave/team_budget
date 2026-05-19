'use server';

import * as m from './members';
import type { z } from 'zod';
import type { inviteMemberSchema } from '@/shared/schemas';

export async function inviteMember(input: z.infer<typeof inviteMemberSchema>) {
  return m.inviteMember(input);
}

export async function deactivateMember(input: { id: string }) {
  return m.deactivateMember(input);
}

export async function reactivateMember(input: { id: string }) {
  return m.reactivateMember(input);
}

export async function changeMemberRole(input: { id: string; role: 'admin' | 'member' }) {
  return m.changeMemberRole(input);
}
