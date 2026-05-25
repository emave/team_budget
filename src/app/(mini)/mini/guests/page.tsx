import Link from 'next/link';
import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniBack } from '../../_components/mini-back';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniLinkButton } from '../../_components/mini-button';

export default async function MiniGuestsPage(props: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const includeArchived = searchParams?.archived === '1';

  const guests = await listGuests(db, { includeArchived });
  const deposits = await listGuestDeposits(db, {});
  const byGuest = new Map<
    string | null,
    { total: number; count: number; last: string | null }
  >();
  for (const d of deposits) {
    const cur = byGuest.get(d.guestId) ?? { total: 0, count: 0, last: null };
    cur.total += d.amount;
    cur.count += 1;
    if (!cur.last || d.receivedAt > cur.last) cur.last = d.receivedAt;
    byGuest.set(d.guestId, cur);
  }

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/more">{m.mini.back}</MiniBack>
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {m.guests.pageTitle}
        </h2>
        <MiniLinkButton href="/mini/received/guest" variant="primary" inline>
          {m.mini.recordCta}
        </MiniLinkButton>
      </div>

      <div className="mini-filterbar">
        <Link
          href={includeArchived ? '/mini/guests' : '/mini/guests?archived=1'}
          data-active={includeArchived}
        >
          {m.guests.showArchived}
        </Link>
      </div>

      <MiniSection>
        {guests.length === 0 ? (
          <MiniEmpty>{m.guests.none}</MiniEmpty>
        ) : (
          guests.map((g) => {
            const agg = byGuest.get(g.id) ?? { total: 0, count: 0, last: null };
            return (
              <MiniRow
                key={g.id}
                title={
                  <>
                    {g.name}
                    {g.archived && (
                      <span style={{ color: 'var(--mini-hint)' }}>
                        {m.guests.archivedSuffix}
                      </span>
                    )}
                  </>
                }
                subtitle={
                  <>
                    {agg.last && <span>{formatDate(agg.last, locale)}</span>}
                    <MiniBadge variant="neutral">
                      {m.guests.colCount}: {agg.count}
                    </MiniBadge>
                  </>
                }
                right={<span>{formatCents(agg.total)}</span>}
              />
            );
          })
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
