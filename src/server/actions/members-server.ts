'use server';

import * as m from './members';
import type { z } from 'zod';
import type { inviteMemberSchema, editMemberSchema } from '@/shared/schemas';

export async function inviteMember(input: z.infer<typeof inviteMemberSchema>) {
  return m.inviteMember(input);
}

export async function deactivateMember(input: { id: string }) {
  return m.deactivateMember(input);
}

export async function reactivateMember(input: { id: string }) {
  return m.reactivateMember(input);
}

export async function editMember(input: z.infer<typeof editMemberSchema>) {
  return m.editMember(input);
}

export async function deleteMember(input: { id: string }) {
  return m.deleteMember(input);
}

export async function revokeInvite(input: { id: string }) {
  return m.revokeInvite(input);
}
