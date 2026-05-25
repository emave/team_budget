import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listDeposits, type DepositSource } from '@/server/domain/deposits';
import { listGuests } from '@/server/domain/guests';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { DepositsView, type PersonOption } from './deposits-view';

type Tab = 'all' | DepositSource;

function parseTab(v: string | undefined): Tab {
  return v === 'members' ? 'member' : v === 'guests' ? 'guest' : 'all';
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function DepositsPage(props: {
  searchParams?: Promise<{ tab?: string; from?: string; to?: string; personId?: string }>;
}) {
  await requireAdmin();
  const sp = (await props.searchParams) ?? {};
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const tab = parseTab(sp.tab);
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;

  const [deposits, members, guests] = await Promise.all([
    listDeposits(db, {
      source: tab,
      personId: sp.personId || undefined,
      range: { from, to },
    }),
    listActiveMembers(db),
    listGuests(db, { includeArchived: true }),
  ]);

  const memberOptions: PersonOption[] = members.map((u) => ({
    id: u.id,
    label: u.displayName,
    source: 'member',
  }));
  const guestOptions: PersonOption[] = guests.map((g) => ({
    id: g.id,
    label: g.archived ? `${g.name}${m.guests.archivedSuffix}` : g.name,
    source: 'guest',
  }));

  return (
    <div>
      <PageHeader title={m.deposits.pageTitle} />
      <Panel>
        <DepositsView
          tab={tab}
          from={from}
          to={to}
          personId={sp.personId ?? null}
          deposits={deposits}
          memberOptions={memberOptions}
          guestOptions={guestOptions}
        />
      </Panel>
    </div>
  );
}
