import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listDeposits, type DepositSource } from '@/server/domain/deposits';
import { listGuests } from '@/server/domain/guests';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniBack } from '../../_components/mini-back';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniCancelButton } from '../../_components/mini-cancel-button';
import { DepositsFilterForm } from './filter-form';

type Tab = 'all' | DepositSource;

function parseTab(v: string | undefined): Tab {
  return v === 'members' ? 'member' : v === 'guests' ? 'guest' : 'all';
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function MiniDepositsPage(props: {
  searchParams?: Promise<{ tab?: string; from?: string; to?: string; personId?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/mini');
  const sp = (await props.searchParams) ?? {};
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const tab = parseTab(sp.tab);
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;

  const [deposits, members, guests] = await Promise.all([
    listDeposits(db, { source: tab, personId: sp.personId || undefined, range: { from, to } }),
    listActiveMembers(db),
    listGuests(db, { includeArchived: true }),
  ]);

  const personOptions = [
    ...members.map((u) => ({ id: u.id, label: u.displayName, source: 'member' as const })),
    ...guests.map((g) => ({
      id: g.id,
      label: g.archived ? `${g.name}${m.guests.archivedSuffix}` : g.name,
      source: 'guest' as const,
    })),
  ];

  const tabKey = tab === 'member' ? 'members' : tab === 'guest' ? 'guests' : 'all';
  const total = deposits.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--mini-text)' }}>
        {m.deposits.pageTitle}
      </h2>

      <div className="mini-tab-row" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['all', 'members', 'guests'] as const).map((k) => {
          const params = new URLSearchParams();
          if (k !== 'all') params.set('tab', k);
          params.set('from', from);
          params.set('to', to);
          const active = k === tabKey;
          return (
            <a
              key={k}
              href={`/mini/deposits${params.toString() ? `?${params.toString()}` : ''}`}
              className="mini-button mini-button--inline"
              style={{
                flex: 1,
                textAlign: 'center',
                background: active ? 'var(--mini-accent)' : 'var(--mini-button-bg)',
                color: active ? 'var(--mini-accent-fg)' : 'var(--mini-text)',
                textDecoration: 'none',
              }}
            >
              {k === 'all' ? m.deposits.tabAll : k === 'members' ? m.deposits.tabMembers : m.deposits.tabGuests}
            </a>
          );
        })}
      </div>

      <DepositsFilterForm
        tab={tabKey}
        initialFrom={from}
        initialTo={to}
        initialPersonId={sp.personId ?? ''}
        personOptions={personOptions.filter((p) => tab === 'all' || p.source === tab)}
      />

      <div className="mini-history-bar">
        {m.deposits.rangeTotal(deposits.length, formatCents(total))}
      </div>

      {deposits.length === 0 ? (
        <MiniEmpty>{m.deposits.empty}</MiniEmpty>
      ) : (
        deposits.map((d) => (
          <MiniRow
            key={`${d.source}-${d.id}`}
            title={
              <>
                {d.source === 'member' ? '👤' : '🧑‍🤝‍🧑'}{' '}
                {d.personName || m.guests.anonymous}
                {d.personArchived ? m.guests.archivedSuffix : ''}
              </>
            }
            subtitle={
              <>
                <MiniBadge variant="neutral">
                  {d.source === 'member' ? m.deposits.sourceMember : m.deposits.sourceGuest}
                </MiniBadge>
                {'  '}
                <span>{d.receivedAt.slice(0, 10)}</span>
                {'  '}
                <span>{d.method === 'cash' ? m.common.cash : m.common.card}</span>
                {d.note ? <>  ·  <span>{d.note}</span></> : null}
              </>
            }
            right={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--mini-success-fg)' }}>+{formatCents(d.amount)}</span>
                <MiniCancelButton id={d.id} kind={d.source === 'member' ? 'payment' : 'guest_deposit'} />
              </span>
            }
          />
        ))
      )}

      <MiniTabs />
    </>
  );
}
