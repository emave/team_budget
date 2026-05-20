# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit a member's display name + role, and hard-delete members who have no financial or content references, from the web UI.

**Architecture:** Replace the standalone role-toggle button on `/members/[id]` with an "Edit" modal that updates display name and role together. Add a "Delete" button gated by a server-side safety check that scans for any references in charges, payments, spendings, info_pages, and invites. Self-deletion is blocked on the server.

**Tech Stack:** Next.js 14 App Router (server actions), Drizzle ORM on better-sqlite3, Base Web (modals/buttons/inputs), TanStack Query for mutations, react-hook-form for the form, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-05-20-admin-user-management-design.md`

---

## File Structure

**New:** none.

**Modified:**

- `src/shared/schemas.ts` — add `editMemberSchema`
- `src/server/domain/users.ts` — add `updateUserProfile`, `canHardDeleteUser`, `hardDeleteUser`, `DeleteBlockReason`; remove `changeRole`
- `src/server/actions/members.ts` — add `editMember`, `deleteMember`; remove `changeMemberRole`
- `src/server/actions/members-server.ts` — mirror the export changes
- `src/app/(app)/members/[id]/page.tsx` — compute `canDelete` and `isSelf`; pass to `AdminControls`
- `src/app/(app)/members/[id]/admin-controls.tsx` — rewrite: Edit modal + Delete confirm; drop role toggle
- `src/shared/i18n/messages-en.ts` — add new strings, remove `makeAdmin`/`makeMember`
- `src/shared/i18n/messages-ru.ts` — same, in Russian
- `tests/domain/users.test.ts` — replace `changeRole` test, add tests for new functions
- `tests/actions/members.test.ts` — replace `changeMemberRole` test, add `editMember`/`deleteMember` tests

---

## Task 1: Domain — `updateUserProfile`

Replaces `changeRole` with a single function that updates display name and role in one statement.

**Files:**
- Modify: `src/server/domain/users.ts`
- Test: `tests/domain/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the existing `it('changes role', …)` block in `tests/domain/users.test.ts` with:

```ts
  it('updates display name and role together', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const updated = await updateUserProfile(db, u.id, {
      displayName: 'Alice II',
      role: 'admin',
    });
    expect(updated.displayName).toBe('Alice II');
    expect(updated.role).toBe('admin');
  });

  it('updateUserProfile throws when user is missing', async () => {
    await expect(
      updateUserProfile(db, '00000000-0000-0000-0000-000000000000', {
        displayName: 'Ghost',
        role: 'member',
      }),
    ).rejects.toThrow(/user not found/);
  });
```

Update the import at the top of the file:

```ts
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
} from '@/server/domain/users';
```

(Remove `changeRole` from that import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: FAIL — `updateUserProfile` is not exported.

- [ ] **Step 3: Implement `updateUserProfile`, remove `changeRole`**

In `src/server/domain/users.ts`, replace the existing `changeRole` function with:

```ts
export async function updateUserProfile(
  db: Db,
  id: string,
  patch: { displayName: string; role: Role },
) {
  db.update(users)
    .set({ displayName: patch.displayName, role: patch.role })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/users.ts tests/domain/users.test.ts
git commit -m "refactor(users): replace changeRole with updateUserProfile"
```

---

## Task 2: Domain — `canHardDeleteUser`

Returns `'has_financial_history'` if the user is referenced by charges, payments, spendings, or info_pages; `'has_invites'` if referenced by invites; `null` otherwise.

**Files:**
- Modify: `src/server/domain/users.ts`
- Test: `tests/domain/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/users.test.ts` (inside the existing `describe`):

```ts
  it('canHardDeleteUser returns null for an isolated user', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    expect(await canHardDeleteUser(db, u.id)).toBeNull();
  });

  it('canHardDeleteUser blocks user with a charge', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: u.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: admin.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks the charge creator too', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: admin.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks user with a payment', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.payments).values({
      id: 'p1', payerUserId: u.id, method: 'cash', amount: 100,
      receivedAt: '2026-01-01T00:00:00Z', createdByUserId: admin.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks user with a spending', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.spendings).values({
      id: 's1', pot: 'cash', amount: 100, description: 'd',
      occurredAt: '2026-01-01T00:00:00Z', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks info-page editor', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.infoPages).values({
      id: 'i1', title: 't', body: 'b', updatedByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser flags invite creator', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.invites).values({
      id: 'inv1', token: 'tok1', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_invites');
  });

  it('canHardDeleteUser flags invite consumer', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.invites).values({
      id: 'inv1', token: 'tok1', createdByUserId: admin.id,
      consumedByUserId: u.id, consumedAt: '2026-01-01T00:00:00Z',
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_invites');
  });
```

Add `canHardDeleteUser` to the import block at the top of the file and add a `schema` import:

```ts
import * as schema from '@/server/db/schema';
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
  canHardDeleteUser,
} from '@/server/domain/users';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: FAIL — `canHardDeleteUser` is not exported.

- [ ] **Step 3: Implement `canHardDeleteUser`**

In `src/server/domain/users.ts`, add the `DeleteBlockReason` type near the top (after the `Role` export) and the new function after `updateUserProfile`:

```ts
export type DeleteBlockReason = 'has_financial_history' | 'has_invites';
```

Add these imports at the top:

```ts
import { eq, or } from 'drizzle-orm';
import { charges, payments, spendings, infoPages, invites } from '@/server/db/schema';
```

(Keep the existing `users` import; merge `or` into the existing `drizzle-orm` import.)

Then add:

```ts
export async function canHardDeleteUser(
  db: Db,
  id: string,
): Promise<DeleteBlockReason | null> {
  const hasCharge = db
    .select({ id: charges.id })
    .from(charges)
    .where(or(eq(charges.userId, id), eq(charges.createdByUserId, id)))
    .limit(1)
    .get();
  if (hasCharge) return 'has_financial_history';

  const hasPayment = db
    .select({ id: payments.id })
    .from(payments)
    .where(or(eq(payments.payerUserId, id), eq(payments.createdByUserId, id)))
    .limit(1)
    .get();
  if (hasPayment) return 'has_financial_history';

  const hasSpending = db
    .select({ id: spendings.id })
    .from(spendings)
    .where(eq(spendings.createdByUserId, id))
    .limit(1)
    .get();
  if (hasSpending) return 'has_financial_history';

  const hasInfoPage = db
    .select({ id: infoPages.id })
    .from(infoPages)
    .where(eq(infoPages.updatedByUserId, id))
    .limit(1)
    .get();
  if (hasInfoPage) return 'has_financial_history';

  const hasInvite = db
    .select({ id: invites.id })
    .from(invites)
    .where(or(eq(invites.createdByUserId, id), eq(invites.consumedByUserId, id)))
    .limit(1)
    .get();
  if (hasInvite) return 'has_invites';

  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/users.ts tests/domain/users.test.ts
git commit -m "feat(users): add canHardDeleteUser reference check"
```

---

## Task 3: Domain — `hardDeleteUser`

Deletes the user's sessions, then the user row. Throws if blocking references remain (defence in depth).

**Files:**
- Modify: `src/server/domain/users.ts`
- Test: `tests/domain/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/domain/users.test.ts`:

```ts
  it('hardDeleteUser removes the user and their sessions', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    db.insert(schema.sessions).values({
      token: 'tok', userId: u.id, expiresAt: '2099-01-01T00:00:00Z',
    }).run();

    await hardDeleteUser(db, u.id);

    expect(db.select().from(schema.users).where(eq(schema.users.id, u.id)).get()).toBeUndefined();
    expect(db.select().from(schema.sessions).where(eq(schema.sessions.userId, u.id)).get())
      .toBeUndefined();
  });

  it('hardDeleteUser refuses when references remain', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: u.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: admin.id,
    }).run();

    await expect(hardDeleteUser(db, u.id)).rejects.toThrow(/cannot delete/i);
  });
```

Add `hardDeleteUser` to the imports at the top and add `eq` from `drizzle-orm`:

```ts
import { eq } from 'drizzle-orm';
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
  canHardDeleteUser,
  hardDeleteUser,
} from '@/server/domain/users';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: FAIL — `hardDeleteUser` is not exported.

- [ ] **Step 3: Implement `hardDeleteUser`**

In `src/server/domain/users.ts`, add the `sessions` import:

```ts
import { sessions, users, charges, payments, spendings, infoPages, invites } from '@/server/db/schema';
```

Then add at the bottom:

```ts
export async function hardDeleteUser(db: Db, id: string) {
  const reason = await canHardDeleteUser(db, id);
  if (reason) throw new Error(`cannot delete: ${reason}`);
  db.delete(sessions).where(eq(sessions.userId, id)).run();
  db.delete(users).where(eq(users.id, id)).run();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/domain/users.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/users.ts tests/domain/users.test.ts
git commit -m "feat(users): add hardDeleteUser"
```

---

## Task 4: Schema — `editMemberSchema`

**Files:**
- Modify: `src/shared/schemas.ts`

- [ ] **Step 1: Add schema**

Append to `src/shared/schemas.ts`:

```ts
export const editMemberSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1).max(80),
  role: roleSchema,
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas.ts
git commit -m "feat(schemas): add editMemberSchema"
```

---

## Task 5: Action — `editMember`

Replaces `changeMemberRole` with `editMember`, which updates both display name and role.

**Files:**
- Modify: `src/server/actions/members.ts`
- Modify: `src/server/actions/members-server.ts`
- Test: `tests/actions/members.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/actions/members.test.ts`, replace the `it('admin can change role', …)` block with:

```ts
  it('admin can edit name and role together', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const actions = makeMemberActions({ getDb: () => db });
    const r = await actions.editMember({ id: m.id, displayName: 'Mary', role: 'admin' });
    expect(r.displayName).toBe('Mary');
    expect(r.role).toBe('admin');
  });

  it('editMember rejects empty display name', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const actions = makeMemberActions({ getDb: () => db });
    await expect(
      actions.editMember({ id: m.id, displayName: '   ', role: 'member' }),
    ).rejects.toThrow();
  });

  it('member cannot edit', async () => {
    const target = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const memberLogin = await createUser(db, { telegramUserId: 3, displayName: 'X', role: 'member' });
    const s = await createSession(db, memberLogin.id);
    cookieRef.value = signCookie(s.token, SECRET);
    const actions = makeMemberActions({ getDb: () => db });
    await expect(
      actions.editMember({ id: target.id, displayName: 'Mary', role: 'member' }),
    ).rejects.toThrow(/admin required/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/actions/members.test.ts`

Expected: FAIL — `editMember` is not a property.

- [ ] **Step 3: Implement `editMember` and remove `changeMemberRole`**

In `src/server/actions/members.ts`:

Update the schema and domain imports:

```ts
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
} from '@/server/domain/users';
import { z } from 'zod';
```

(Remove the `roleSchema` import and the `changeRole as domainChangeRole` import.)

Replace the `changeMemberRole` action with `editMember`:

```ts
  const editMember = adminAction(async ({ db }, input: z.infer<typeof editMemberSchema>) => {
    const parsed = editMemberSchema.parse(input);
    return updateUserProfile(db, parsed.id, {
      displayName: parsed.displayName,
      role: parsed.role,
    });
  });
```

Update the returned bundle and the named exports at the bottom of the file:

```ts
  return { inviteMember, deactivateMember, reactivateMember, editMember, revokeInvite };
}

const prod = makeMemberActions();
export const inviteMember = prod.inviteMember;
export const deactivateMember = prod.deactivateMember;
export const reactivateMember = prod.reactivateMember;
export const editMember = prod.editMember;
export const revokeInvite = prod.revokeInvite;
```

In `src/server/actions/members-server.ts`, replace `changeMemberRole` with `editMember`:

```ts
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

export async function revokeInvite(input: { id: string }) {
  return m.revokeInvite(input);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/actions/members.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/members.ts src/server/actions/members-server.ts tests/actions/members.test.ts
git commit -m "feat(members): editMember action replaces changeMemberRole"
```

---

## Task 6: Action — `deleteMember`

Admin-only. Rejects self-targeting and unsafe deletes. Calls `hardDeleteUser`.

**Files:**
- Modify: `src/server/actions/members.ts`
- Modify: `src/server/actions/members-server.ts`
- Test: `tests/actions/members.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/actions/members.test.ts`:

```ts
  it('admin can delete an isolated member', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const actions = makeMemberActions({ getDb: () => db });
    const r = await actions.deleteMember({ id: m.id });
    expect(r).toEqual({ ok: true });
  });

  it('admin cannot delete themselves', async () => {
    const actions = makeMemberActions({ getDb: () => db });
    await expect(actions.deleteMember({ id: adminId })).rejects.toThrow(/cannot delete self/);
  });

  it('cannot delete a member with charges', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    db.insert((await import('@/server/db/schema')).charges).values({
      id: 'c1', userId: m.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: adminId,
    }).run();
    const actions = makeMemberActions({ getDb: () => db });
    await expect(actions.deleteMember({ id: m.id })).rejects.toThrow(/has_financial_history/);
  });

  it('member cannot delete', async () => {
    const target = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const memberLogin = await createUser(db, { telegramUserId: 3, displayName: 'X', role: 'member' });
    const s = await createSession(db, memberLogin.id);
    cookieRef.value = signCookie(s.token, SECRET);
    const actions = makeMemberActions({ getDb: () => db });
    await expect(actions.deleteMember({ id: target.id })).rejects.toThrow(/admin required/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/actions/members.test.ts`

Expected: FAIL — `deleteMember` is not a property.

- [ ] **Step 3: Implement `deleteMember`**

In `src/server/actions/members.ts`, expand the `users` domain import:

```ts
import {
  updateUserProfile,
  deactivateUser,
  reactivateUser,
  canHardDeleteUser,
  hardDeleteUser,
} from '@/server/domain/users';
```

Also add the `ActionError` import:

```ts
import { ActionError, makeAdminAction } from './_wrapper';
```

(Update the existing `makeAdminAction` import line.)

Add the `deleteMember` action inside `makeMemberActions`:

```ts
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
```

Add `deleteMember` to the returned bundle and exports:

```ts
  return { inviteMember, deactivateMember, reactivateMember, editMember, deleteMember, revokeInvite };
}

const prod = makeMemberActions();
export const inviteMember = prod.inviteMember;
export const deactivateMember = prod.deactivateMember;
export const reactivateMember = prod.reactivateMember;
export const editMember = prod.editMember;
export const deleteMember = prod.deleteMember;
export const revokeInvite = prod.revokeInvite;
```

In `src/server/actions/members-server.ts`, add:

```ts
export async function deleteMember(input: { id: string }) {
  return m.deleteMember(input);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/actions/members.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/members.ts src/server/actions/members-server.ts tests/actions/members.test.ts
git commit -m "feat(members): deleteMember action with safety check"
```

---

## Task 7: i18n strings

Add Edit/Delete strings, remove `makeAdmin` / `makeMember`. Both locales kept in sync.

**Files:**
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

- [ ] **Step 1: Update English messages**

In `src/shared/i18n/messages-en.ts`, replace the `makeMember` / `makeAdmin` lines inside `members:` with:

```ts
    editModalTitle: 'Edit member',
    editDisplayNameLabel: 'Display name',
    roleLabel: 'Role',
    roleAdmin: 'Admin',
    roleMember: 'Member',
    deleteButton: 'Delete',
    confirmDelete: (name: string) => `Delete ${name}? This cannot be undone.`,
    deleteBlockedHasHistory: 'Has financial history — deactivate instead',
    deleteBlockedHasInvites: 'Has invites — deactivate instead',
```

(Place these after the existing `reactivate: 'Reactivate',` line. Remove both `makeMember` and `makeAdmin`.)

- [ ] **Step 2: Update Russian messages**

In `src/shared/i18n/messages-ru.ts`, make the same replacement inside `members:`:

```ts
    editModalTitle: 'Изменить участника',
    editDisplayNameLabel: 'Отображаемое имя',
    roleLabel: 'Роль',
    roleAdmin: 'Администратор',
    roleMember: 'Участник',
    deleteButton: 'Удалить',
    confirmDelete: (name: string) => `Удалить ${name}? Это нельзя отменить.`,
    deleteBlockedHasHistory: 'Есть финансовая история — лучше деактивировать',
    deleteBlockedHasInvites: 'Есть приглашения — лучше деактивировать',
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

Expected: PASS.

If TypeScript complains that `makeAdmin` / `makeMember` are still referenced, that means the admin-controls rewrite (Task 9) hasn't landed yet — comment out the references temporarily or proceed directly into Task 9 in the same commit. (If both locales have parallel shapes, the type checker will complain about a mismatch — both files should have identical keys at the end of this task.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts
git commit -m "feat(i18n): strings for Edit modal and Delete action"
```

---

## Task 8: Page — pass `canDelete` and `isSelf` to AdminControls

**Files:**
- Modify: `src/app/(app)/members/[id]/page.tsx`

- [ ] **Step 1: Update the page**

Edit `src/app/(app)/members/[id]/page.tsx`. Add `canHardDeleteUser` to the `users` domain import:

```ts
import { getUserById, canHardDeleteUser } from '@/server/domain/users';
```

Inside `MemberDetail`, after the `payments` line, add:

```ts
  const deleteBlockedReason = me.role === 'admin' ? await canHardDeleteUser(db, u.id) : null;
  const isSelf = me.id === u.id;
```

Update the `<AdminControls />` invocation:

```tsx
        actions={me.role === 'admin' ? (
          <AdminControls
            user={{ id: u.id, displayName: u.displayName, isActive: u.isActive, role: u.role }}
            isSelf={isSelf}
            deleteBlockedReason={deleteBlockedReason}
          />
        ) : null}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

Expected: FAIL — the new props aren't on `AdminControls` yet. (That's resolved by Task 9.)

- [ ] **Step 3: Don't commit yet**

The page and the component must land together for the type-check to pass. Commit after Task 9.

---

## Task 9: AdminControls — Edit modal + Delete confirm

Rewrite the component. Removes the role-toggle button; adds Edit modal and Delete confirm.

**Files:**
- Modify: `src/app/(app)/members/[id]/admin-controls.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/app/(app)/members/[id]/admin-controls.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { Button, KIND } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { RadioGroup, Radio } from 'baseui/radio';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  deactivateMember,
  reactivateMember,
  editMember,
  deleteMember,
} from '@/server/actions/members-server';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import type { DeleteBlockReason } from '@/server/domain/users';

interface Props {
  user: { id: string; displayName: string; isActive: boolean; role: 'admin' | 'member' };
  isSelf: boolean;
  deleteBlockedReason: DeleteBlockReason | null;
}

interface EditForm {
  displayName: string;
  role: 'admin' | 'member';
}

export function AdminControls({ user, isSelf, deleteBlockedReason }: Props) {
  const m = useMessages();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { register, control, handleSubmit, reset } = useForm<EditForm>({
    defaultValues: { displayName: user.displayName, role: user.role },
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateMember({ id: user.id }),
    onSuccess: () => router.refresh(),
  });
  const reactivate = useMutation({
    mutationFn: () => reactivateMember({ id: user.id }),
    onSuccess: () => router.refresh(),
  });
  const edit = useMutation({
    mutationFn: (v: EditForm) =>
      editMember({ id: user.id, displayName: v.displayName, role: v.role }),
    onSuccess: () => {
      setEditOpen(false);
      router.refresh();
    },
  });
  const del = useMutation({
    mutationFn: () => deleteMember({ id: user.id }),
    onSuccess: () => router.push('/members'),
  });

  const blockedText =
    deleteBlockedReason === 'has_financial_history'
      ? m.members.deleteBlockedHasHistory
      : deleteBlockedReason === 'has_invites'
        ? m.members.deleteBlockedHasInvites
        : null;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        kind={KIND.secondary}
        onClick={() => {
          reset({ displayName: user.displayName, role: user.role });
          setEditOpen(true);
        }}
      >
        {m.common.edit}
      </Button>

      {user.isActive ? (
        <Button
          kind={KIND.secondary}
          onClick={() => deactivate.mutate()}
          isLoading={deactivate.isPending}
        >
          {m.members.deactivate}
        </Button>
      ) : (
        <Button
          kind={KIND.secondary}
          onClick={() => reactivate.mutate()}
          isLoading={reactivate.isPending}
        >
          {m.members.reactivate}
        </Button>
      )}

      {!isSelf && (
        <>
          <Button
            kind={KIND.secondary}
            disabled={blockedText !== null}
            onClick={() => setConfirmDeleteOpen(true)}
            isLoading={del.isPending}
          >
            {m.members.deleteButton}
          </Button>
          {blockedText && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>{blockedText}</span>
          )}
        </>
      )}

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)}>
        <ModalHeader>{m.members.editModalTitle}</ModalHeader>
        <ModalBody>
          <form
            id="edit-member-form"
            onSubmit={handleSubmit((v) => edit.mutate(v))}
          >
            <FormControl label={m.members.editDisplayNameLabel}>
              <Input {...(register('displayName') as object)} />
            </FormControl>
            <FormControl label={m.members.roleLabel}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  >
                    <Radio value="admin">{m.members.roleAdmin}</Radio>
                    <Radio value="member">{m.members.roleMember}</Radio>
                  </RadioGroup>
                )}
              />
            </FormControl>
            {edit.isError && (
              <p style={{ color: '#b91c1c', marginTop: 12 }}>
                {edit.error instanceof Error ? edit.error.message : String(edit.error)}
              </p>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setEditOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            type="submit"
            form="edit-member-form"
            isLoading={edit.isPending}
          >
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <ModalHeader>{m.members.deleteButton}</ModalHeader>
        <ModalBody>{m.members.confirmDelete(user.displayName)}</ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setConfirmDeleteOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => {
              setConfirmDeleteOpen(false);
              del.mutate();
            }}
            isLoading={del.isPending}
          >
            {m.members.deleteButton}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Lint (if a lint script exists)**

Run: `pnpm lint`

Expected: PASS (or no new warnings).

If `pnpm lint` is not defined, skip this step.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm vitest run`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/members/\[id\]/admin-controls.tsx src/app/\(app\)/members/\[id\]/page.tsx
git commit -m "feat(members): admin Edit modal and Delete from web UI"
```

---

## Task 10: Manual smoke test

Verify the feature works end-to-end against a running app.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

Open: `http://localhost:3000` and sign in as the bootstrap admin.

- [ ] **Step 2: Edit a member**

Navigate to `/members`, click a non-self member, click **Edit**, change the display name, switch the role, click **Save**. Confirm the page refreshes with the new values.

- [ ] **Step 3: Try to delete a member with history**

Navigate to a member who has charges or payments. Confirm the **Delete** button is disabled and the inline reason text is shown.

- [ ] **Step 4: Hard-delete an isolated member**

Create a fresh invite, consume it (or use a freshly invited account with no charges). Open that member's detail page, click **Delete**, confirm. Expect redirect to `/members` and the member is gone from the list.

- [ ] **Step 5: Verify self-protection**

On your own member detail page (`/members/<your-id>`), confirm the **Delete** button is not shown.

- [ ] **Step 6: Verify role change still works**

On any member, open **Edit**, flip the role, save. Reload and confirm the role badge in the list reflects the change.

---

## Self-review notes

- All spec sections (UI placement, edit modal, delete confirm, server contract, page work, i18n, tests, files touched, data flow) map to tasks above.
- The page edit in Task 8 fails type-check until Task 9 adds the matching props on `AdminControls`. Tasks 8 + 9 are committed together (see Task 9 Step 5).
- The `DeleteBlockReason` type is exported from `domain/users.ts` (Task 2) and consumed by both the page (Task 8) and the client component (Task 9).
- `editMember` and `deleteMember` are added/exported in lockstep across `members.ts` and `members-server.ts`.
- The i18n changes (Task 7) remove `makeAdmin` and `makeMember` — the only consumer (the old admin-controls toggle) is removed in Task 9, which is why Task 7's typecheck step warns about ordering.
