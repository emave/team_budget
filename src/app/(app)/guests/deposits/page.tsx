import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { guestDepositSummary } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { Matrix, type MatrixData } from './matrix';

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function GuestDepositsPage(
  props: {
    searchParams?: Promise<{ from?: string; to?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const def = defaultRange();
  const from = searchParams?.from ?? def.from;
  const to = searchParams?.to ?? def.to;

  const allGuests = await listGuests(db, { includeArchived: true });
  const summary = await guestDepositSummary(db, { from, to });

  const guestsInRange = new Set(summary.map((s) => s.guestId).filter((id): id is string => id !== null));
  const hasAnon = summary.some((s) => s.guestId === null);

  const columns = allGuests
    .filter((g) => guestsInRange.has(g.id))
    .map((g) => ({ id: g.id, label: g.name, archived: g.archived }));

  const dates = [...new Set(summary.map((s) => s.date))].sort().reverse();

  const cells = new Map<string, number>();
  for (const s of summary) cells.set(`${s.date}|${s.guestId ?? ''}`, s.amount);

  const data: MatrixData = { from, to, dates, columns, hasAnon, cells: Object.fromEntries(cells) };

  return (
    <div>
      <PageHeader title={m.guests.depositsPageTitle} />
      <Panel>
        <Matrix data={data} />
      </Panel>
    </div>
  );
}
