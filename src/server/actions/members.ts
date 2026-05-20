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
  getUserById,
} from '@/server/domain/users';
import { z } from 'zod';
import { syncAdminCommandsForUser } from '@/server/bot/admin-commands';

export function makeMemberActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const inviteMember = adminAction(async ({ user, db }, input: z.infer<typeof inviteMemberSchema>) => {
    const parsed = inviteMemberSchema.parse(input);
    return createInvite(db, { createdByUserId: user.id, displayNameHint: parsed.displayNameHint ?? null });
  });

  const deactivateMember = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    const updated = await deactivateUser(db, id);
    await syncAdminCommandsForUser(updated);
    return updated;
  });

  const reactivateMember = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    const updated = await reactivateUser(db, id);
    await syncAdminCommandsForUser(updated);
    return updated;
  });

  const editMember = adminAction(async ({ db }, input: z.infer<typeof editMemberSchema>) => {
    const parsed = editMemberSchema.parse(input);
    const updated = await updateUserProfile(db, parsed.id, {
      displayName: parsed.displayName,
      role: parsed.role,
    });
    await syncAdminCommandsForUser(updated);
    return updated;
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
    const target = await getUserById(db, id);
    await hardDeleteUser(db, id);
    if (target) await syncAdminCommandsForUser({ ...target, role: 'member', isActive: false });
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
