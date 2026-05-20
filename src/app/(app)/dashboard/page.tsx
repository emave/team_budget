import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { recentActivity } from '@/server/domain/activity';
import { formatCents } from '@/shared/format';
import { getMessages } from '@/shared/i18n';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { PotCard } from './pot-card';
import { MemberRow } from './member-row';
import { ActivityFeed } from './activity';

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  if (user.role === 'admin') {
    const [pots, members] = await Promise.all([getPotBalances(db), listActiveMembers(db)]);
    const debts = await Promise.all(members.map((mm) => getMemberOutstandingDebt(db, mm.id)));
    const events = await recentActivity(db, 10);

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label={m.dashboard.cashPot} cents={pots.cash} currency={settings.currency} />
          <PotCard label={m.dashboard.cardPot} cents={pots.card} currency={settings.currency} />
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>{m.dashboard.membersHeading(members.length)}</h3>
          {members.map((mm, i) => (
            <MemberRow
              key={mm.id}
              id={mm.id}
              displayName={mm.displayName}
              role={mm.role}
              debt={debts[i] ?? 0}
              currency={settings.currency}
              locale={locale}
            />
          ))}
        </div>
        <ActivityFeed events={events} currency={settings.currency} locale={locale} />
      </div>
    );
  }

  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  return (
    <div>
      <div
        style={{
          padding: 24,
          background: debt > 0 ? '#fef2f2' : '#f0fdf4',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>
          {debt > 0 ? m.dashboard.youOwe(user.displayName) : m.dashboard.youSettled(user.displayName)}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: debt > 0 ? '#dc2626' : '#16a34a' }}>
          {formatCents(debt, settings.currency)}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>{m.dashboard.teamSummary}</h3>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          {m.dashboard.potsLine(
            formatCents(pots.cash, settings.currency),
            formatCents(pots.card, settings.currency),
          )}
        </div>
      </div>
    </div>
  );
}
