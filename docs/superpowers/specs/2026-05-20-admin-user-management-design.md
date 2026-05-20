# Admin user management: edit and delete

## Summary

Admins can edit and delete members from the web UI. "Edit" combines renaming
(display name) and role assignment into a single dialog on the member detail
page. "Delete" is a true hard delete, allowed only when the member has no
references in any financial or content table; otherwise the action is shown
disabled with a one-line explanation pointing the admin to deactivate.

## Scope

In scope:

- Edit member display name and role from a single modal on `/members/[id]`
- Hard-delete a member, gated by a safety check
- Self-protection: an admin cannot hard-delete themselves
- Removal of the standalone "Make admin / Make member" toggle (folded into Edit)

Out of scope:

- Soft delete is already implemented (deactivate/reactivate) and stays as-is
- Editing other user fields (telegram username, locale, photo)
- Self-protection for the existing deactivate or role-change paths
- Inline row actions on the members list table
- Cascade-style hard delete that anonymizes historical references

## User-visible behaviour

### Member detail page toolbar

When the current viewer is an admin, `/members/[id]` shows this toolbar:

| Button                       | Visibility                                    |
| ---------------------------- | --------------------------------------------- |
| **Edit**                     | Always                                        |
| **Deactivate** / **Reactivate** | Always (unchanged)                         |
| **Delete**                   | Hidden when viewing self; otherwise visible   |

The Delete button is **disabled** when the member has any references that block
hard deletion. The disabled state shows the reason text *"Has financial history
— deactivate instead"* (localised).

### Edit modal

A single dialog with:

- Display name — text input, pre-filled with current value
- Role — radio group: Admin / Member

Save calls one server action that updates both fields. Cancel discards changes.
Closing without changes is a no-op.

### Delete confirmation

A confirm dialog: *"Delete `<display name>`? This cannot be undone."* On
confirm, the action runs. On success, the page redirects to `/members`.

## Server contract

### New schema

In `src/shared/schemas.ts`:

```ts
export const editMemberSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1).max(80),
  role: roleSchema,
});
```

### New domain functions

In `src/server/domain/users.ts`:

- `updateUserProfile(db, id, { displayName, role })` — writes both fields in
  one UPDATE; returns the refreshed row. Replaces `changeRole`.
- `canHardDeleteUser(db, id): Promise<DeleteBlockReason | null>` — returns a
  reason key when the user cannot be hard-deleted, `null` when they can.
- `hardDeleteUser(db, id)` — deletes the user's sessions, then the user row.
  Throws if the user still has blocking references (defence in depth; the
  caller is expected to have checked `canHardDeleteUser` already).

```ts
export type DeleteBlockReason =
  | 'has_financial_history'   // charges, payments, spendings, info_pages
  | 'has_invites';            // created or consumed invites
```

`has_financial_history` covers references in `charges.userId`,
`charges.createdByUserId`, `payments.payerUserId`, `payments.createdByUserId`,
`spendings.createdByUserId`, and `info_pages.updatedByUserId`. Implementation
checks each table; the first hit determines the returned reason. The UI maps
both reasons to the same localised string for v1 ("Has financial history —
deactivate instead"); the reason key is exposed in case we want finer-grained
copy later.

### New / changed server actions

In `src/server/actions/members.ts`:

- **`editMember(input)`** — admin-only. Parses `editMemberSchema`. Calls
  `updateUserProfile`. Returns the refreshed user row.
- **`deleteMember(input: { id })`** — admin-only. Parses `idSchema`. Throws
  `ActionError('FORBIDDEN', 'cannot delete self')` when `input.id` equals the
  current user id. Calls `canHardDeleteUser`; if it returns a reason, throws
  `ActionError('FORBIDDEN', reason)`. Otherwise calls `hardDeleteUser` and
  returns `{ ok: true }`.
- **`changeMemberRole`** — removed. The action is no longer exported from
  `members.ts` or `members-server.ts`. `domain/users.ts:changeRole` is also
  removed.

The corresponding entries in `src/server/actions/members-server.ts` are added
(for `editMember`, `deleteMember`) or removed (for `changeMemberRole`).

### Page server work

`src/app/(app)/members/[id]/page.tsx` additionally calls
`canHardDeleteUser(db, u.id)` and passes:

```ts
<AdminControls
  user={{ id, displayName, isActive, role }}
  isSelf={me.id === u.id}
  deleteBlockedReason={canHardDeleteUser_result}
/>
```

## UI components

### `admin-controls.tsx` (rewritten)

- Hooks up three mutations: `editMember`, `deactivateMember` / `reactivateMember`
  (kept), `deleteMember`.
- Renders Edit, Deactivate/Reactivate, Delete buttons per the visibility rules
  above.
- Edit button opens a Base Web modal containing a small form (controlled
  React state — no need for `react-hook-form` for two fields).
- Delete button opens a Base Web modal confirm. On success, calls
  `router.push('/members')`.
- The `changeMemberRole` mutation and the Make admin/Make member button are
  removed.

### i18n

Add to both `messages-en.ts` and `messages-ru.ts`, under `members`:

- `edit` — "Edit" / "Изменить"
- `editModalTitle` — "Edit member" / "Изменить участника"
- `roleLabel` — "Role" / "Роль"
- `roleAdmin` — "Admin" / "Администратор"
- `roleMember` — "Member" / "Участник"
- `deleteButton` — "Delete" / "Удалить"
- `confirmDelete: (name: string) => ...`
- `deleteBlockedHasHistory` — "Has financial history — deactivate instead" /
  RU equivalent
- `save` — "Save" / "Сохранить" (reuse `m.common.save` if it exists; otherwise
  add)

Remove the now-unused `makeAdmin` and `makeMember` entries from both locales.

The `displayNameLabel` and `displayNamePlaceholder` already used by the invite
modal are reused in the Edit modal.

## Authorisation and safety

- Both new actions go through `makeAdminAction`, so non-admins get
  `FORBIDDEN`.
- `deleteMember` additionally rejects self-targeting and re-checks
  `canHardDeleteUser` server-side. The UI's disabled state is convenience; the
  server is the source of truth.
- No new auth checks are added to existing actions (`deactivateMember`,
  `reactivateMember`).
- Renaming a member does not affect Telegram identity (`telegramUserId`,
  `telegramUsername`); only `displayName` is updated.

## Data flow for delete

```
Admin clicks Delete on /members/[id]
  → confirm dialog
  → deleteMember({ id })
      → admin guard
      → if id === current user → FORBIDDEN 'cannot delete self'
      → reason = canHardDeleteUser(db, id)
      → if reason → FORBIDDEN reason
      → hardDeleteUser(db, id)
          → DELETE FROM sessions WHERE user_id = id
          → DELETE FROM users WHERE id = id
      → return { ok: true }
  → router.push('/members')
```

## Testing

Domain (`tests/domain/users.test.ts`):

- `updateUserProfile` updates both fields in a single call
- `canHardDeleteUser` returns `'has_financial_history'` for users referenced by
  charges, payments, spendings, or info_pages (one assertion per table)
- `canHardDeleteUser` returns `'has_invites'` for an invite creator or consumer
- `canHardDeleteUser` returns `null` for an isolated user
- `hardDeleteUser` removes sessions then the user
- `hardDeleteUser` throws when the user still has blocking references

Actions (`tests/actions/members.test.ts`):

- `editMember` updates a user as admin; rejects non-admin with `FORBIDDEN`
- `editMember` rejects invalid input (empty / >80 chars name, bad role)
- `deleteMember` deletes an isolated user as admin
- `deleteMember` rejects when current user targets self
- `deleteMember` rejects when the user has financial history (returns the
  reason in the error message)
- `deleteMember` rejects non-admin with `FORBIDDEN`
- The existing `changeMemberRole` tests are rewritten as `editMember` tests
  and the old ones removed.

## Files touched

New behaviour, no new files:

- `src/shared/schemas.ts` — add `editMemberSchema`
- `src/server/domain/users.ts` — add `updateUserProfile`, `canHardDeleteUser`,
  `hardDeleteUser`; remove `changeRole`
- `src/server/actions/members.ts` — add `editMember`, `deleteMember`; remove
  `changeMemberRole`
- `src/server/actions/members-server.ts` — mirror the export changes
- `src/app/(app)/members/[id]/page.tsx` — compute `canDelete` flag and
  `isSelf`, pass to `AdminControls`; pass `displayName`
- `src/app/(app)/members/[id]/admin-controls.tsx` — rewrite per UI section
- `src/shared/i18n/messages-en.ts`, `messages-ru.ts` — add new strings, remove
  `makeAdmin`/`makeMember`
- `tests/domain/users.test.ts` — extend
- `tests/actions/members.test.ts` — replace role-change tests, add edit/delete
  tests

## Open risks

- A stale page could let an admin click Delete after a charge has just been
  created against the member. The server re-checks and returns FORBIDDEN, but
  the user sees a generic error toast. Acceptable for v1; surface the reason
  string later if needed.
- `hardDeleteUser` is a two-statement non-transactional sequence (sessions
  then users). On `better-sqlite3` both statements run synchronously in the
  same process, and the schema's FK from `sessions.user_id` to `users.id` is
  not `ON DELETE CASCADE`, so a crash between the two statements would orphan
  sessions only if the process dies mid-call — extremely unlikely. Wrapping
  in `db.transaction()` is a small follow-up if it ever becomes a concern.
