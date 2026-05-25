import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMemberCreditBalances } from '@/server/domain/credit';
import { users } from '@/server/db/schema';
import { listPendingInvites } from '@/server/domain/invites';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages, type Locale } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniLinkRow } from '../../_components/mini-link-row';
import { MiniLinkButton } from '../../_components/mini-button';

export default async function MiniPeoplePage(props: {
  searchParams?: Promise<{ tab?: string; archived?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';
  const tab: 'members' | 'guests' = sp.tab === 'guests' && isAdmin ? 'guests' : 'members';

  return (
    <>
      <MiniInit />
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {m.people.title}
        </h2>
        {isAdmin && tab === 'members' && (
          <MiniLinkButton href="/mini/people/invite" variant="primary" inline>
            {m.mini.inviteCta}
          </MiniLinkButton>
        )}
        {isAdmin && tab === 'guests' && (
          <MiniLinkButton href="/mini/received/guest" variant="primary" inline>
            {m.mini.recordCta}
          </MiniLinkButton>
        )}
      </div>

      {isAdmin && (
        <div className="mini-filterbar">
          <Link href="/mini/people" data-active={tab === 'members'}>
            {m.people.tabMembers}
          </Link>
          <Link href="/mini/people?tab=guests" data-active={tab === 'guests'}>
            {m.people.tabGuests}
          </Link>
        </div>
      )}

      {tab === 'members' && (
        <MembersFeed db={db} locale={locale} m={m} isAdmin={isAdmin} />
      )}
      {tab === 'guests' && (
        <GuestsFeed db={db} locale={locale} m={m} archived={sp.archived === '1'} />
      )}

      <MiniTabs />
    </>
  );
}

async function MembersFeed({
  db,
  locale,
  m,
  isAdmin,
}: {
  db: ReturnType<typeof getDb>;
  locale: Locale;
  m: ReturnType<typeof getMessages>;
  isAdmin: boolean;
}) {
  const all = db.select().from(users).all();
  const [debts, credits] = await Promise.all([
    Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id))),
    listMemberCreditBalances(db),
  ]);
  const creditByUser = new Map(credits.map((c) => [c.userId, c.balance]));
  const rows = all.map((u, i) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    debt: debts[i] ?? 0,
    credit: creditByUser.get(u.id) ?? 0,
  }));

  const pendingInvites = isAdmin ? await listPendingInvites(db) : [];

  return (
    <>
      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.common.none}</MiniEmpty>
        ) : (
          rows.map((r) => (
            <MiniLinkRow
              key={r.id}
              href={`/mini/people/${r.id}`}
              title={
                <>
                  {r.displayName}
                  {!r.isActive && (
                    <span style={{ color: 'var(--mini-hint)' }}> {m.common.inactive}</span>
                  )}
                </>
              }
              subtitle={
                <>
                  <span>
                    {r.role === 'admin' ? m.people.roleAdmin : m.people.roleMember}
                  </span>
                  {r.credit > 0 && (
                    <MiniBadge variant="success">{formatCents(r.credit)}</MiniBadge>
                  )}
                </>
              }
              right={
                r.debt > 0 ? (
                  <MiniBadge variant="danger">
                    {m.common.owesAmount(formatCents(r.debt))}
                  </MiniBadge>
                ) : (
                  <MiniBadge variant="success">{m.people.settledBadge}</MiniBadge>
                )
              }
            />
          ))
        )}
      </MiniSection>

      {isAdmin && (
        <MiniSection heading={m.people.pendingInvitesTitle}>
          {pendingInvites.length === 0 ? (
            <MiniEmpty>{m.people.noPendingInvites}</MiniEmpty>
          ) : (
            pendingInvites.map((p) => (
              <MiniRow
                key={p.id}
                title={p.displayNameHint || m.mini.linkPlaceholder}
                subtitle={<span>{formatDate(p.createdAt, locale)}</span>}
                right={
                  <MiniBadge variant="neutral">
                    {p.token.slice(0, 8)}…
                  </MiniBadge>
                }
              />
            ))
          )}
        </MiniSection>
      )}
    </>
  );
}

async function GuestsFeed({
  db,
  locale,
  m,
  archived,
}: {
  db: ReturnType<typeof getDb>;
  locale: Locale;
  m: ReturnType<typeof getMessages>;
  archived: boolean;
}) {
  const guests = await listGuests(db, { includeArchived: archived });
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
      <MiniSection>
        {guests.length === 0 ? (
          <MiniEmpty>{m.people.guests.none}</MiniEmpty>
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
                        {m.people.guests.archivedSuffix}
                      </span>
                    )}
                  </>
                }
                subtitle={
                  <>
                    {agg.last && <span>{formatDate(agg.last, locale)}</span>}
                    <MiniBadge variant="neutral">
                      {m.people.guests.colCount}: {agg.count}
                    </MiniBadge>
                  </>
                }
                right={<span>{formatCents(agg.total)}</span>}
              />
            );
          })
        )}
      </MiniSection>
      <div style={{ marginTop: 12 }}>
        <Link
          href={archived ? '/mini/people?tab=guests' : '/mini/people?tab=guests&archived=1'}
        >
          {m.people.showArchivedGuests}
        </Link>
      </div>
    </>
  );
}
