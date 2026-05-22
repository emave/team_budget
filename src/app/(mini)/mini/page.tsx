import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getMemberOutstandingDebt, listChargesFiltered } from '@/server/domain/charges';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { getCreditBalance, getTotalCreditLiability } from '@/server/domain/credit';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from './init';
import { MiniTabs } from './tabs';
import { MiniCard } from '../_components/mini-card';
import { MiniRow } from '../_components/mini-row';
import { MiniSection } from '../_components/mini-section';
import { MiniEmpty } from '../_components/mini-empty';

interface RecentItem {
  key: string;
  iso: string;
  title: string;
  subtitle: string;
  amount: number;
  icon: string;
}

export default async function MiniDashboard() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  const creditBalance = await getCreditBalance(db, user.id);
  const teamCreditLiability =
    user.role === 'admin' ? await getTotalCreditLiability(db) : 0;
  const settings = await getOrCreateSettings(db);
  const dues = settings.monthlyDuesAmount;
  const monthsCovered = dues > 0 ? Math.floor(creditBalance / dues) : 0;

  const [recentCharges, recentPayments] = await Promise.all([
    listChargesFiltered(db, { userId: user.id, limit: 5 }),
    listPaymentsByPayer(db, user.id),
  ]);

  const items: RecentItem[] = [
    ...recentCharges.map((c) => ({
      key: `c-${c.id}`,
      iso: c.createdAt,
      title: c.description,
      subtitle: formatDate(c.createdAt, locale),
      amount: c.amount,
      icon: '🧾',
    })),
    ...recentPayments.slice(0, 5).map((p) => ({
      key: `p-${p.id}`,
      iso: p.receivedAt,
      title: p.method === 'cash' ? m.common.methodCash : m.common.methodCard,
      subtitle: formatDate(p.receivedAt, locale),
      amount: p.amount,
      icon: p.method === 'cash' ? '💵' : '💳',
    })),
  ]
    .sort((a, b) => (a.iso < b.iso ? 1 : -1))
    .slice(0, 5);

  return (
    <>
      <MiniInit />

      <MiniCard variant={debt > 0 ? 'debt' : 'settled'} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
          {debt > 0 ? m.mini.youOwe : m.mini.settled}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{formatCents(debt)}</div>
      </MiniCard>

      {creditBalance > 0 && (
        <MiniCard style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
            {m.wallet.title}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {formatCents(creditBalance)}
          </div>
          {monthsCovered > 0 && dues > 0 && (
            <div style={{ fontSize: 11, color: 'var(--mini-hint)', marginTop: 2 }}>
              {m.wallet.coversMonths(monthsCovered, formatCents(dues))}
            </div>
          )}
        </MiniCard>
      )}

      {user.role === 'admin' && teamCreditLiability > 0 && (
        <MiniCard style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
            {m.wallet.dashboard.liabilityLabel}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
            {formatCents(teamCreditLiability)}
          </div>
        </MiniCard>
      )}

      {user.role === 'admin' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <MiniCard>
            <div
              style={{
                fontSize: 11,
                color: 'var(--mini-hint)',
                textTransform: 'uppercase',
              }}
            >
              {m.dashboard.cashPot}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 2,
                color: 'var(--mini-text)',
              }}
            >
              {formatCents(pots.cash)}
            </div>
          </MiniCard>
          <MiniCard>
            <div
              style={{
                fontSize: 11,
                color: 'var(--mini-hint)',
                textTransform: 'uppercase',
              }}
            >
              {m.dashboard.cardPot}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 2,
                color: 'var(--mini-text)',
              }}
            >
              {formatCents(pots.card)}
            </div>
          </MiniCard>
        </div>
      )}

      <MiniSection heading={m.dashboard.movementsHeading}>
        {items.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          items.map((it) => (
            <MiniRow
              key={it.key}
              title={
                <>
                  {it.icon} {it.title}
                </>
              }
              subtitle={<span>{it.subtitle}</span>}
              right={<span>{formatCents(it.amount)}</span>}
            />
          ))
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
