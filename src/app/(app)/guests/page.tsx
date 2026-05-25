import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { LinkButton } from '@/ui/link-button';
import { GuestsTable, type GuestRow } from './guests-table';
import { NewGuestButton } from './new-guest-button';

export default async function GuestsPage(
  props: {
    searchParams?: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const includeArchived = searchParams?.archived === '1';
  const guests = await listGuests(db, { includeArchived });
  const deposits = await listGuestDeposits(db, {});
  const byGuest = new Map<string | null, { total: number; count: number; last: string | null }>();
  for (const d of deposits) {
    const cur = byGuest.get(d.guestId) ?? { total: 0, count: 0, last: null };
    cur.total += d.amount;
    cur.count += 1;
    if (!cur.last || d.receivedAt > cur.last) cur.last = d.receivedAt;
    byGuest.set(d.guestId, cur);
  }
  const rows: GuestRow[] = guests.map((g) => {
    const agg = byGuest.get(g.id) ?? { total: 0, count: 0, last: null };
    return {
      id: g.id,
      name: g.name,
      archived: g.archived,
      totalFormatted: formatCents(agg.total),
      count: agg.count,
      lastFormatted: agg.last ? formatDate(agg.last, locale) : '—',
    };
  });
  return (
    <div>
      <PageHeader
        title={m.guests.pageTitle}
        actions={
          <>
            <LinkButton href="/guests/deposits" kind="secondary">
              📊 {m.guests.depositsPageTitle}
            </LinkButton>
            <NewGuestButton />
          </>
        }
      />
      <Panel>
        <GuestsTable rows={rows} />
      </Panel>
      <div style={{ marginTop: 12 }}>
        <a href={includeArchived ? '/guests' : '/guests?archived=1'}>{m.guests.showArchived}</a>
      </div>
    </div>
  );
}
