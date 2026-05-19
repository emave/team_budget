import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { PotCard } from './pot-card';
import { MemberRow } from './member-row';

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);

  if (user.role === 'admin') {
    const [pots, members] = await Promise.all([getPotBalances(db), listActiveMembers(db)]);
    const debts = await Promise.all(members.map((m) => getMemberOutstandingDebt(db, m.id)));

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label="Cash pot" cents={pots.cash} currency={settings.currency} />
          <PotCard label="Card pot" cents={pots.card} currency={settings.currency} />
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>Members ({members.length})</h3>
          {members.map((m, i) => (
            <MemberRow
              key={m.id}
              id={m.id}
              displayName={m.displayName}
              role={m.role}
              debt={debts[i] ?? 0}
              currency={settings.currency}
            />
          ))}
        </div>
      </div>
    );
  }

  // Member view
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
          {debt > 0 ? `${user.displayName} — You owe` : `${user.displayName} — Settled`}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: debt > 0 ? '#dc2626' : '#16a34a' }}>
          {formatCents(debt, settings.currency)}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>Team summary</h3>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Cash pot {formatCents(pots.cash, settings.currency)} · Card pot {formatCents(pots.card, settings.currency)}
        </div>
      </div>
    </div>
  );
}
