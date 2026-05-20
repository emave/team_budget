import 'server-only';
import { ActionError, makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  inviteMemberSchema,
  editMemberSchema,
  idSchema,
} from '@/shared/schemas';
import { createInvite, revokeInvite as domainRevokeInvite } from '@/server/domain/invites';
import {
  updateUserProfile,
  deactivateUser,
  reactivateUser,
  canHardDeleteUser,
  hardDeleteUser,
} from '@/server/domain/users';
import { z } from 'zod';

export function makeMemberActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const inviteMember = adminAction(async ({ user, db }, input: z.infer<typeof inviteMemberSchema>) => {
    const parsed = inviteMemberSchema.parse(input);
    return createInvite(db, { createdByUserId: user.id, displayNameHint: parsed.displayNameHint ?? null });
  });

  const deactivateMember = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return deactivateUser(db, id);
  });

  const reactivateMember = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return reactivateUser(db, id);
  });

  const editMember = adminAction(async ({ db }, input: z.infer<typeof editMemberSchema>) => {
    const parsed = editMemberSchema.parse(input);
    return updateUserProfile(db, parsed.id, {
      displayName: parsed.displayName,
      role: parsed.role,
    });
  });

  const deleteMember = adminAction(async ({ user, db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    if (id === user.id) {
      throw new ActionError('FORBIDDEN', 'cannot delete self');
    }
    const reason = await canHardDeleteUser(db, id);
    if (reason) {
      throw new ActionError('FORBIDDEN', reason);
    }
    await hardDeleteUser(db, id);
    return { ok: true as const };
  });

  const revokeInvite = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainRevokeInvite(db, id);
  });

  return { inviteMember, deactivateMember, reactivateMember, editMember, deleteMember, revokeInvite };
}

const prod = makeMemberActions();
export const inviteMember = prod.inviteMember;
export const deactivateMember = prod.deactivateMember;
export const reactivateMember = prod.reactivateMember;
export const editMember = prod.editMember;
export const deleteMember = prod.deleteMember;
export const revokeInvite = prod.revokeInvite;
