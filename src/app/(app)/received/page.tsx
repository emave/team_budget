import { requireAdmin, requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listDeposits, type DepositSource } from '@/server/domain/deposits';
import { listGuests } from '@/server/domain/guests';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { LinkButton } from '@/ui/link-button';
import { ActionNewIcon } from '@/ui/icons';
import { ReceivedView, type PersonOption } from './received-view';

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

export default async function ReceivedPage(props: {
  searchParams?: Promise<{ tab?: string; from?: string; to?: string; personId?: string }>;
}) {
  const me = await requireUser();
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
    label: g.archived ? `${g.name}${m.people.guests.archivedSuffix}` : g.name,
    source: 'guest',
  }));

  return (
    <div>
      <PageHeader
        title={m.received.pageTitle}
        actions={
          me.role === 'admin' ? (
            <LinkButton href="/received/new" startEnhancer={<ActionNewIcon />}>
              {m.received.record}
            </LinkButton>
          ) : null
        }
      />
      <Panel>
        <ReceivedView
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
