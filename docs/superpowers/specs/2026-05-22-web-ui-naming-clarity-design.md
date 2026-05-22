# Web UI Naming Clarity — Design

Date: 2026-05-22
Status: Approved (user said "go")

## Problem

The web UI's three money-flow pages — "Charges", "Payments", "Spendings" — are
hard to distinguish at a glance, in both English and Russian. New members can't
tell which page handles which concept, and even existing users hesitate.

Concretely:
- "Spendings" is not idiomatic English ("spending" is uncountable).
- "Payments" reads ambiguously — payments by whom, to whom?
- "Charges" is correct domain English but easy to confuse with "Spendings".
- In Russian, "Начисления / Платежи / Траты" suffer the same overlap.

## Goals

1. Each of the three pages should be unambiguous from the nav alone.
2. A first-time user landing on a page should understand its purpose without
   reading any rows.
3. Zero behavioural change — same pages, same URLs, same data, same actions.

## Non-goals

- No restructuring (no merging pages, no new sections, no nav reordering).
- No URL changes — `/charges`, `/payments`, `/spendings` still resolve. Existing
  bookmarks survive.
- No changes to the Telegram Mini App or the bot — their vocabularies stay.
- No DB schema or internal type-name changes.
- No "Pot" / "Cash pot" / "Card pot" rename (user explicitly skipped).

## Approach

Two coordinated changes:

1. **Disambiguating renames** of the three pages and their adjacent strings,
   using money-direction framing (debt / in / out).
2. **One-line subtitles** under each page heading, explaining the page's role
   in plain language.

The combination handles two audiences: returning users get a clearer nav label,
newcomers get an explanation right where they land.

## Rename map

User-facing strings only. Internal identifiers, URLs, DB columns, file paths
are unchanged.

### Nav and page titles

| Key | EN: now → new | RU: now → new |
|---|---|---|
| `nav.charges`              | Charges → **Debts**               | Начисления → **Долги**          |
| `nav.payments`             | Payments → **Payments in**        | Платежи → **Поступления**       |
| `nav.spendings`            | Spendings → **Expenses**          | Траты → **Расходы**             |
| `charges.title`            | Charges → **Debts**               | Начисления → **Долги**          |
| `payments.title`           | Payments → **Payments in**        | Платежи → **Поступления**       |
| `spendings.title`          | Spendings → **Expenses**          | Траты → **Расходы**             |

### Page subtitles (new keys)

| New key | EN | RU |
|---|---|---|
| `charges.subtitle`   | What members owe the team             | Что участники должны команде              |
| `payments.subtitle`  | Money members paid back to the team   | Деньги, полученные от участников          |
| `spendings.subtitle` | Money the team spent from its pots    | Что команда потратила из касс             |

### Adjacent strings that follow the rename

| Key | EN: now → new | RU: now → new |
|---|---|---|
| `members.openCharges`        | Open charges → **Open debts**            | Открытые начисления → **Открытые долги** |
| `charges.newCharge`          | New charge → **+ New debt**              | Новое начисление → **Новый долг** |
| `charges.newPageTitle`       | New charge → **New debt**                | Новое начисление → **Новый долг** |
| `charges.submitAdhoc`        | Create charge → **Create debt**          | Создать начисление → **Создать долг** |
| `charges.submitSplit`        | Create split charge → **Create split debt** | Создать разделённое начисление → **Создать разделённый долг** |
| `charges.submitPotBorrow`    | unchanged ("Record pot borrow" / "Записать заём из кассы") |
| `spendings.record`           | Record spending → **Record expense**     | Записать трату → **Записать расход** |
| `spendings.submit`           | Record spending → **Record expense**     | Записать трату → **Записать расход** |
| `spendings.newPageTitle`     | Record spending → **Record expense**     | Запись траты → **Запись расхода** |
| `payments.record`            | unchanged ("Record payment" / "Записать платёж") — the verb is still correct |
| `payments.submit`            | unchanged |
| `payments.newPageTitle`      | unchanged ("Record payment" / "Запись платежа") |

### Strings that stay

- `charges.statusOpen` / `statusPaid` / `statusCancelled` — debt statuses; "paid" still applies to a debt.
- `charges.typeAdhoc` / `typeSplit` / `typePotBorrow` / `typeMonthlyDues` / `typeOutOfBounds` — internal sub-categories.
- `charges.filter*` — All / Open / Paid / Cancelled. Generic.
- All `mini.*` strings — Mini App is out of scope.
- All `bot.*` strings — bot is out of scope.

## PageHeader component

`src/ui/page-header.tsx` currently:

```tsx
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode })
```

Extend to:

```tsx
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
})
```

Rendering: heading stays as `HeadingMedium`. If `subtitle` is set, render it
directly below the heading using `LabelSmall` (or equivalent ~13px muted text)
with `color: theme.colors.contentSecondary`. The title-row layout (flex with
actions on the right) remains; the subtitle is a second row inside the left
column so the actions stay vertically centered on the title.

Sketch:

```
[ Debts                                              [+ New debt] ]
[ What members owe the team                                       ]
```

## Files touched

1. `src/shared/i18n/messages-en.ts` — apply rename map, add three `subtitle` keys.
2. `src/shared/i18n/messages-ru.ts` — mirror.
3. `src/ui/page-header.tsx` — add `subtitle` prop and render.
4. `src/app/(app)/charges/page.tsx` — pass `subtitle={m.charges.subtitle}`.
5. `src/app/(app)/payments/page.tsx` — pass `subtitle={m.payments.subtitle}`.
6. `src/app/(app)/spendings/page.tsx` — pass `subtitle={m.spendings.subtitle}`.

No new files. No schema. No URL changes. No data migrations.

## Risk and rollout

- **TypeScript** enforces parity between EN and RU via `MESSAGES_RU: Messages`,
  so any missing key or renamed key surfaces at compile time. Safety net is in
  place; no extra tooling needed.
- **Tests**: existing e2e tests likely assert on visible text ("Charges",
  "Payments", "Spendings"). The implementation plan will grep for these strings
  in `tests/` and update them in lockstep.
- **Users**: returning users will see new labels on next page load. The label
  change is small enough that no in-app notice is warranted.
- **Reversibility**: rename map is fully reversible by reverting two i18n files
  + page-header + three page.tsx files. No data implications.

## Open questions

None at design time. User explicitly:
- Picked the "short, money-direction" naming set (Debts / Payments in /
  Expenses).
- Confirmed web-UI scope (Mini App and bot excluded).
- Said "go" — proceed to implementation plan.
