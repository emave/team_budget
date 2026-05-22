# Mobile-friendly UI redesign

## Problem

The `(app)` admin/desktop UI is unusable on a phone. The header navigation crams 8 icon links plus brand + user name + language switcher into one row. Every listing page (`/members`, `/charges`, `/payments`, `/spendings`, `/guests`, plus the open-charges and payment-history tables on `/members/[id]`) uses `baseui/table-semantic` — columns don't reflow, so on a narrow viewport content gets squished or hidden. `PageHeader` is a flex row with `justify-content: space-between` that doesn't wrap, so the 4-button `AdminControls` on member-detail overflow. `MoneyHistory` has a fixed `minWidth: 280` DatePicker that pushes the heading off-screen. Forms use desktop-spacing assumptions.

The `(mini)` Telegram surface is already mobile-first but a few rows and chips have sub-44px tap targets.

We want one unified, mobile-first layout for `(app)` that scales up to desktop without going back to dense tables. Cards instead of tables, hamburger drawer instead of a packed icon row, vertical-stack forms.

## Scope

In:
- New app shell: sticky top bar with hamburger + drawer nav; replace `HeaderNavigation` use in [src/app/(app)/header.tsx](../../../src/app/(app)/header.tsx).
- New shared primitives in [src/ui/](../../../src/ui/): `DataList`, `DataCard`, `MobileDrawer` (thin wrapper over `baseui/drawer`), `breakpoints.ts` tokens module. `PageHeader` updated to wrap.
- Convert every `TableBuilder` use in `(app)` to `DataList` / `DataCard`. Affected files: [members-table.tsx](../../../src/app/(app)/members/members-table.tsx), [charges-table.tsx](../../../src/app/(app)/charges/charges-table.tsx), [payments-table.tsx](../../../src/app/(app)/payments/payments-table.tsx), [spendings-table.tsx](../../../src/app/(app)/spendings/spendings-table.tsx), [guests-table.tsx](../../../src/app/(app)/guests/guests-table.tsx), [pending-invites-table.tsx](../../../src/app/(app)/members/pending-invites-table.tsx), [detail-tables.tsx](../../../src/app/(app)/members/[id]/detail-tables.tsx), [matrix.tsx](../../../src/app/(app)/guests/deposits/matrix.tsx) (matrix stays a wide grid behind horizontal scroll, but its container loses fixed widths).
- Dashboard restructure: pots stack vertically; "View money history" link → new page [src/app/(app)/dashboard/history/page.tsx](../../../src/app/(app)/dashboard/history/page.tsx) hosting the existing `MoneyHistory` component unchanged.
- Forms: stack fields vertically, full-width inputs and submit buttons, no hardcoded `minWidth` on DatePickers. Affected: [adhoc-form.tsx](../../../src/app/(app)/charges/new/adhoc-form.tsx), [split-form.tsx](../../../src/app/(app)/charges/new/split-form.tsx), [pot-borrow-form.tsx](../../../src/app/(app)/charges/new/pot-borrow-form.tsx), [record-form (payments)](../../../src/app/(app)/payments/new/record-form.tsx), [record-form (spendings)](../../../src/app/(app)/spendings/new/record-form.tsx), [dues-form.tsx](../../../src/app/(app)/settings/dues-form.tsx), [pot-openings-form.tsx](../../../src/app/(app)/settings/pot-openings-form.tsx), [charge-dues-form.tsx](../../../src/app/(app)/members/[id]/charge-dues-form.tsx).
- `MoneyHistory` panel: drop `minWidth: 280` on the DatePicker wrapper; let header wrap.
- Login page: ensure centered, 16px padding, no hardcoded widths; verify viewport meta.
- `(mini)` polish: tap-target ≥44px on `mini-row`, `mini-tabs`, `locale-chip`, charges filter chips.
- New i18n keys where needed: `dashboard.viewHistory` (link label), `nav.menu` (hamburger aria-label), `nav.close` (drawer close aria-label). Reuse all existing labels.

Out:
- Dark mode.
- PWA / offline / install prompt.
- Any server-action signature, schema, or business-logic change.
- New theme; we stay on Base Web `createLightTheme()`.
- `MoneyHistory` internal rework; it gets a dedicated page so its existing wide grid stays usable.
- `/mini` structural changes beyond touch-target sweep.

## Design

### Breakpoint

Single breakpoint constant in new file [src/ui/breakpoints.ts](../../../src/ui/breakpoints.ts):

```ts
export const SMALL_MAX_PX = 599; // < 600px → "narrow"
export const SMALL = `@media (max-width: ${SMALL_MAX_PX}px)`;
```

Matches Base Web's `theme.mediaQuery.medium` boundary so consumers can use either form.

### App shell

[src/app/(app)/layout.tsx](../../../src/app/(app)/layout.tsx) renders a new `AppShell` client component instead of inline `AppHeader` + `<main>`:

```
┌─────────────────────────────────────────────┐
│ [☰]   🎯 Team Budget          Alice · EN ▾ │  sticky, height 56
├─────────────────────────────────────────────┤
│   <main: max-width 720, padding 16, mx auto>│
└─────────────────────────────────────────────┘
```

[src/app/(app)/header.tsx](../../../src/app/(app)/header.tsx) is replaced (file renamed conceptually; keep filename for git history) with two exports:

- `AppShell({ displayName, role, children })` — renders top bar + drawer + content. Wraps `<main>`.
- The old `AppHeader` export is removed; layout switches to `AppShell`.

Top bar:
- Left: `IconButton` (hamburger), 44×44, `aria-label={m.nav.menu}`. Tap toggles drawer.
- Centre-left: brand "🎯 {m.brand}", `font-weight: 700`. Hidden under 360px via `@media`.
- Right: `displayName` (truncated, `max-width: 120px`, `text-overflow: ellipsis`), admin badge if applicable, `LanguageSwitcher`.
- Background: `theme.colors.backgroundPrimary`, `borderBottom: 1px solid borderOpaque`. `position: sticky; top: 0; z-index: 10`.

Drawer (Base Web `Drawer` with `ANCHOR.left`, `size: '280px'`):
- Header: brand + close button (`aria-label={m.nav.close}`).
- Nav list: one item per `NavItem` from the existing 8-item array. Each item is a `<Link>` with `display: flex; align-items: center; gap: 12; padding: 14px 16px; min-height: 48px`. Icon at left (existing `Nav*Icon` components), label right. Active route gets `theme.colors.backgroundSecondary` background and `font-weight: 600`. Detect active by `usePathname()`; an item is active when `pathname === item.href` or `pathname.startsWith(item.href + '/')`.
- On click, link navigates and the drawer closes (`onClose` is fired manually).
- Footer (sticky bottom of drawer): user name + role + language switcher in a column.

Content `<main>`: `max-width: 720px; margin: 0 auto; padding: 16px`. Keeps the column narrow even on wide desktops — a deliberate choice to keep one layout.

### `DataList` + `DataCard` primitives

New files [src/ui/data-list.tsx](../../../src/ui/data-list.tsx) and [src/ui/data-card.tsx](../../../src/ui/data-card.tsx).

```tsx
<DataList emptyMessage="...">
  <DataCard
    href="/members/abc"            // optional; makes the whole card a link
    title="Alice"
    titleRight="€12.50"            // optional bold amount
    subtitle="admin"               // optional, muted, small
    badges={<><StatusBadge … /></>}// optional row of badges
    actions={<><Button …/></>}     // optional footer
  />
</DataList>
```

Card structure:

```
┌───────────────────────────────────────────────┐
│ Alice                                €12.50   │  ← title row
│ admin                                          │  ← subtitle, muted
│ [credit €12.50] [owes €4.00]                  │  ← badges row
├───────────────────────────────────────────────┤
│ [Cancel]                  [Pay from credit]   │  ← actions footer (optional)
└───────────────────────────────────────────────┘
```

Styling:
- Border `1px solid borderOpaque`, `border-radius: theme.borders.radius300`, `padding: 12px 14px`, `margin-bottom: 8px`.
- When `href` is set: card is an `<a>` (Next `<Link>`), `cursor: pointer`, `hover: background backgroundSecondary`, `:focus-visible` outline. Interactive children inside (`<button>`, `<a>`) call `e.stopPropagation()` on click so they don't trigger the card link.
- Actions footer: when present, separated by `1px solid borderOpaque` margin-top: 10, padding-top: 10. One action → right-aligned. Two+ actions → flex row, equal width, gap 8.
- `titleRight` is `font-weight: 600`, `font-size: 18px`. Money. Aligned right of the title row via `display: flex; justify-content: space-between`.

`DataList`:
- Renders children directly (no wrapper element). When children array is empty, renders a `<Muted>` line with `emptyMessage` and padding 24, text-align center.

### Page conversions

Each `*-table.tsx` becomes a thin transform from row → `DataCard`. Component signature stays `({ rows }) => ...` so server pages don't change.

`/members` [members-table.tsx](../../../src/app/(app)/members/members-table.tsx):
- For each `MemberRow`:
  - `href={'/members/' + r.id}`
  - `title={r.displayName}{r.isActive ? '' : ' · inactive'}`
  - `subtitle={r.role}`
  - `badges`: when `r.creditFormatted` → `<StatusBadge tone="positive">{credit}</StatusBadge>`; when `r.debtFormatted` → `<StatusBadge tone="negative">{m.common.owesAmount(r.debtFormatted)}</StatusBadge>`; when neither → `<StatusBadge tone="positive">{m.common.settled}</StatusBadge>`.
- Old `ClickableRow` hack deleted.

`/charges` [charges-table.tsx](../../../src/app/(app)/charges/charges-table.tsx):
- Per `ChargeRow`:
  - No `href` (charges don't have a detail page).
  - `title={r.description} — {r.userDisplayName}`
  - `titleRight={r.amountFormatted}`
  - `subtitle`: `{TYPE_KEY label} · {r.whenFormatted}` (joined with `·`).
  - `badges`: status badge with existing tone/icon logic.
  - `actions`: same conditional `PayFromCreditButton` + `CancelChargeButton` as today.

`/payments` [payments-table.tsx](../../../src/app/(app)/payments/payments-table.tsx) — `PaymentRow { id, payerDisplayName, method, amountFormatted, whenFormatted, cancelled, showCancel }`:
- `title={r.payerDisplayName}`
- `titleRight={r.amountFormatted}`
- `subtitle={r.method}`
- `badges`: when `r.cancelled` → `<StatusBadge tone="neutral" icon={<StatusCancelledIcon/>}>{m.common.cancelled}</StatusBadge>`; else `<Muted>{r.whenFormatted}</Muted>` (rendered as a small caption row beneath the badges — when only a `Muted` time is shown we render it as `subtitle` instead and skip the badges row).
- `actions={r.showCancel ? <CancelPaymentButton id={r.id}/> : null}`

`/spendings` [spendings-table.tsx](../../../src/app/(app)/spendings/spendings-table.tsx) — `SpendingRow { id, pot, description, category, amountFormatted, whenFormatted, cancelled, showCancel }`:
- `title={r.description}`
- `titleRight={r.amountFormatted}`
- `subtitle`: joined `{r.pot} · {r.category} · {r.whenFormatted}` (use `·` separators in a single muted line).
- `badges`: when `r.cancelled` → cancelled badge (as above); otherwise no badges.
- `actions={r.showCancel ? <CancelSpendingButton id={r.id}/> : null}`

`/guests` [guests-table.tsx](../../../src/app/(app)/guests/guests-table.tsx) — `GuestRow { id, name, archived, totalFormatted, count, lastFormatted }`:
- `title={r.name}{r.archived ? m.guests.archivedSuffix : ''}`
- `titleRight={r.totalFormatted}`
- `subtitle`: `{r.count} · {r.lastFormatted}` (count = number of deposits — keep current semantic; render with a tiny inline label like `m.guests.colCount` if it improves clarity, otherwise raw count).
- `actions={<><RenameButton id={r.id} name={r.name}/><ArchiveButton id={r.id} archived={r.archived}/></>}` side-by-side.

`/members` pending invites [pending-invites-table.tsx](../../../src/app/(app)/members/pending-invites-table.tsx) — `PendingInviteRow { id, token, displayNameHint, createdAt }`:
- `title={r.displayNameHint ?? m.members.hintEmpty}` (when null, render as muted).
- `subtitle`: formatted `createdAt` via `formatDate`.
- `actions`: existing "Copy link" + "Revoke" buttons (inlined `RowActions` component preserved as-is, just moved into the card footer).

Member detail [detail-tables.tsx](../../../src/app/(app)/members/[id]/detail-tables.tsx):
- `OpenChargesTable` — `OpenChargeRow { id, description, amountFormatted }`: `title={r.description}`, `titleRight={r.amountFormatted}`, no subtitle, no actions. (Member-detail does not render pay-from-credit today; out of scope to add.)
- `PaymentHistoryTable` — `PaymentHistoryRow { id, whenFormatted, method, amountFormatted }`: `title={r.method}`, `titleRight={r.amountFormatted}`, `subtitle={r.whenFormatted}`, no actions.

Guest deposits matrix [matrix.tsx](../../../src/app/(app)/guests/deposits/matrix.tsx):
- Stays a grid (it's a 2D table of guests × periods). Wrap in an `overflow-x: auto` div; remove any hardcoded widths in the cells. Header row sticky-top within the scroll container.

### Dashboard

[src/app/(app)/dashboard/page.tsx](../../../src/app/(app)/dashboard/page.tsx) admin branch:

```tsx
return (
  <div>
    <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
    <PotCard label={m.dashboard.cardPot} cents={pots.card} />
    {totalCreditLiability > 0 && (
      <Panel><Muted>{m.wallet.dashboard.liabilityLabel}: {formatCents(totalCreditLiability)}</Muted></Panel>
    )}
    <Panel>
      <SectionHeading>{m.dashboard.membersHeading(members.length)}</SectionHeading>
      <MembersTable rows={memberRows} />   {/* now renders DataList */}
    </Panel>
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <Link href="/dashboard/history">{m.dashboard.viewHistory}</Link>
    </div>
  </div>
);
```

- The 2-column `gridTemplateColumns: '1fr 1fr'` for pots is removed; pots stack.
- `<MoneyHistory>` is removed from this page.
- `m.dashboard.viewHistory` is the new i18n key ("View money history" / "Посмотреть историю движений" / etc.).

[src/app/(app)/dashboard/pot-card.tsx](../../../src/app/(app)/dashboard/pot-card.tsx): no logic change; verify it has `margin-bottom` between cards so the vertical stack has spacing.

New page [src/app/(app)/dashboard/history/page.tsx](../../../src/app/(app)/dashboard/history/page.tsx):

```tsx
export default async function DashboardHistory({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/dashboard');
  const db = getDb();
  const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
  const movements = await listMoneyMovements(db, { from: range.from, to: range.to });
  return (
    <div>
      <PageHeader title={getMessages(await resolveLocaleForRequest()).dashboard.movementsHeading} />
      <MoneyHistory movements={movements} range={range} clamped={range.clamped} />
    </div>
  );
}
```

Inside `MoneyHistory`, the DatePicker wrapper drops `minWidth: 280`; the heading + picker flex row gains `flex-wrap: wrap; row-gap: 8px`.

Member-branch dashboard stays as today (just gets the wider-than-mobile column narrowing automatically from the new `<main>` max-width).

### `PageHeader` ([src/ui/page-header.tsx](../../../src/ui/page-header.tsx))

Replace the outer flex-row with a wrapping layout:

```tsx
<div className={css({
  display: 'flex',
  flexWrap: 'wrap',
  rowGap: theme.sizing.scale400,
  columnGap: theme.sizing.scale600,
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: theme.sizing.scale600,
})}>
  <div className={css({ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 })}>
    <HeadingMedium>{title}</HeadingMedium>
    {subtitle ? <LabelSmall>{subtitle}</LabelSmall> : null}
  </div>
  {actions ? (
    <div className={css({ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 })}>
      {actions}
    </div>
  ) : null}
</div>
```

Effect: on a wide screen, title and actions sit side-by-side as today. When the actions row can't fit, it wraps onto the next line. Actions themselves also wrap when crowded.

`AdminControls` ([src/app/(app)/members/[id]/admin-controls.tsx](../../../src/app/(app)/members/[id]/admin-controls.tsx)):
- Wrap the 4 buttons (rename, role-toggle, archive, delete) so each can shrink. Below 600px (use `SMALL` breakpoint): `display: grid; grid-template-columns: 1fr 1fr; gap: 8px;` so they form a 2×2.
- The destructive "Delete" stays in the grid but gets `kind="tertiary"` and an explicit visual gap (top margin) so it's not pressed by accident next to "Rename".

### Forms

Rules applied across all form components:
- `<FormControl>` renders one field per row. Remove any `display: flex; gap` two-field rows.
- Submit button: `<Button overrides={{ BaseButton: { style: { width: '100%' } } }}>` on narrow widths. We add a small helper `<SubmitButton>` in [src/ui/submit-button.tsx](../../../src/ui/submit-button.tsx) that does this.
- DatePicker: drop any hardcoded `minWidth`. Use `width: 100%`.

Per-file specifics:

`SplitForm` ([src/app/(app)/charges/new/split-form.tsx](../../../src/app/(app)/charges/new/split-form.tsx)):
- Per-member row: under 600px → block-level (`name` above `amount input`); above → grid `grid-template-columns: 1fr 120px`.
- "Split equally" button: not sticky (keeps things simple); rendered above the list with `width: 100%` on narrow.

`NewChargeTabs` ([src/app/(app)/charges/new/new-charge-tabs.tsx](../../../src/app/(app)/charges/new/new-charge-tabs.tsx)):
- Wrap the Base Web `Tabs` in a div with `overflow-x: auto; -webkit-overflow-scrolling: touch` so labels can scroll when they don't fit.

### Login page ([src/app/login/page.tsx](../../../src/app/login/page.tsx))

- Outer container: `min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 24px`.
- LanguageSwitcher placed in a top-right corner via `position: absolute; top: 16px; right: 16px`.
- Telegram Login Widget container has no fixed width.

[src/app/layout.tsx](../../../src/app/layout.tsx) `metadata`/`viewport`:
- Verify Next 14 `viewport` export sets `width: 'device-width', initialScale: 1`. If missing, add an `export const viewport: Viewport = { width: 'device-width', initialScale: 1 }`.

### `(mini)` polish

- [src/app/(mini)/_components/mini-row.tsx](../../../src/app/(mini)/_components/mini-row.tsx): ensure `min-height: 48px` on the row; verify padding ≥12px vertical when interactive (`href` present).
- [src/app/(mini)/mini/tabs.tsx](../../../src/app/(mini)/mini/tabs.tsx): each tab button `min-height: 44px`; wrap row in horizontal-scroll if labels overflow.
- [src/app/(mini)/_components/locale-chip.tsx](../../../src/app/(mini)/_components/locale-chip.tsx): `min-height: 40px; padding: 8px 12px`.
- [src/app/(mini)/mini/charges/page.tsx](../../../src/app/(mini)/mini/charges/page.tsx) filter chips: same as locale-chip.

No structural changes to mini.

### i18n

New keys in [src/shared/i18n/](../../../src/shared/i18n/):
- `dashboard.viewHistory` → "View money history" / "Посмотреть историю движений" / "Глядзець гісторыю рухаў".
- `nav.menu` → "Menu" / "Меню" / "Меню".
- `nav.close` → "Close" / "Закрыть" / "Закрыць".

All other strings reuse existing keys (the nav labels, member/charge/payment column labels reused as card titles or subtitles).

### Tests

The redesign is presentational; no domain logic changes. Test coverage:
- Unit (Vitest, `tests/ui/`): smoke-render tests for `DataCard` — renders `title`, `titleRight`, `subtitle`, `badges`, `actions`; clicking an interactive child does not navigate when `href` is set (verify `stopPropagation`).
- Existing unit and integration tests must keep passing — they exercise actions and domain logic, which we don't touch.
- Manual: open the app in a phone-sized viewport (use DevTools or actual phone via Cloudflare Tunnel) and walk the golden path: login → dashboard → members → member detail → charges → payments → settings → drawer nav.

### Risk

- `TableBuilder` is replaced site-wide. Risk that a row prop was being relied upon for accessibility or screen-reader semantics; mitigated by giving `DataCard` proper roles (`<a>` for linkable, plain `<div>` otherwise, no `role="row"` since it's no longer a tabular structure).
- The dashboard `MoneyHistory` move to a sub-page changes a URL surface; an existing bookmark to `/dashboard` no longer shows history inline. Acceptable — there's a prominent link.
- `<main>` capped at 720px is narrower than today's 1080px. Wide-screen users get more whitespace. By design (single layout).
