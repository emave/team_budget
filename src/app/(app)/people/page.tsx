import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMemberCreditBalances } from '@/server/domain/credit';
import { users } from '@/server/db/schema';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { listPendingInvites } from '@/server/domain/invites';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { SectionHeading } from '@/ui/heading';
import { InviteButton } from './invite-button';
import { MembersTable, type MemberRow } from './members-table';
import { PendingInvitesTable, type PendingInviteRow } from './pending-invites-table';
import { GuestsTable, type GuestRow } from './_guests/guests-table';
import { NewGuestButton } from './_guests/new-guest-button';

type Tab = 'members' | 'guests';

export default async function PeoplePage(props: {
  searchParams?: Promise<{ tab?: string; archived?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const me = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = me.role === 'admin';
  const tab: Tab = sp.tab === 'guests' && isAdmin ? 'guests' : 'members';

  return (
    <div>
      <PageHeader
        title={m.people.title}
        actions={
          isAdmin ? (tab === 'members' ? <InviteButton /> : <NewGuestButton />) : null
        }
      />
      {isAdmin && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 13 }}>
          <Link href="/people">{m.people.tabMembers}</Link>
          <Link href="/people?tab=guests">{m.people.tabGuests}</Link>
        </div>
      )}
      {tab === 'members' ? (
        <MembersSection db={db} m={m} isAdmin={isAdmin} />
      ) : (
        <GuestsSection db={db} m={m} locale={locale} archived={sp.archived === '1'} />
      )}
    </div>
  );
}

async function MembersSection({
  db,
  m,
  isAdmin,
}: {
  db: ReturnType<typeof getDb>;
  m: ReturnType<typeof getMessages>;
  isAdmin: boolean;
}) {
  const all = db.select().from(users).all();
  const [debts, credits] = await Promise.all([
    Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id))),
    listMemberCreditBalances(db),
  ]);
  const creditByUser = new Map(credits.map((c) => [c.userId, c.balance]));
  const shaped: MemberRow[] = all.map((u, i) => {
    const debt = debts[i] ?? 0;
    const credit = creditByUser.get(u.id) ?? 0;
    return {
      id: u.id,
      displayName: u.displayName,
      role: u.role as 'admin' | 'member',
      isActive: u.isActive,
      debtFormatted: debt > 0 ? formatCents(debt) : null,
      creditFormatted: credit > 0 ? formatCents(credit) : null,
    };
  });
  const pendingInvites: PendingInviteRow[] = isAdmin
    ? (await listPendingInvites(db)).map((i) => ({
        id: i.id,
        token: i.token,
        displayNameHint: i.displayNameHint,
        createdAt: i.createdAt,
      }))
    : [];
  return (
    <>
      <Panel marginBottom={isAdmin ? 16 : 0}>
        <MembersTable rows={shaped} />
      </Panel>
      {isAdmin && (
        <Panel>
          <SectionHeading>{m.people.pendingInvitesTitle}</SectionHeading>
          <PendingInvitesTable rows={pendingInvites} />
        </Panel>
      )}
    </>
  );
}

async function GuestsSection({
  db,
  m,
  locale,
  archived,
}: {
  db: ReturnType<typeof getDb>;
  m: ReturnType<typeof getMessages>;
  locale: 'en' | 'ru';
  archived: boolean;
}) {
  const guests = await listGuests(db, { includeArchived: archived });
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
    <>
      <Panel>
        <GuestsTable rows={rows} />
      </Panel>
      <div style={{ marginTop: 12 }}>
        <a href={archived ? '/people?tab=guests' : '/people?tab=guests&archived=1'}>
          {m.people.showArchivedGuests}
        </a>
      </div>
    </>
  );
}
