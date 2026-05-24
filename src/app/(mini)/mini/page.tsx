import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getMemberOutstandingDebt, listChargesFiltered } from '@/server/domain/charges';
import { listPaymentsByPayer } from '@/server/domain/payments';
import {
  getCreditBalance,
  getTotalCreditLiability,
  listMemberCreditBalances,
} from '@/server/domain/credit';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listActiveMembers } from '@/server/domain/users';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from './init';
import { MiniTabs } from './tabs';
import { MiniCard } from '../_components/mini-card';
import { MiniRow } from '../_components/mini-row';
import { MiniSection } from '../_components/mini-section';
import { MiniEmpty } from '../_components/mini-empty';
import { MiniBadge } from '../_components/mini-badge';
import { MiniLinkRow } from '../_components/mini-link-row';

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
  const isAdmin = user.role === 'admin';

  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  const creditBalance = await getCreditBalance(db, user.id);
  const teamCreditLiability = isAdmin ? await getTotalCreditLiability(db) : 0;
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

  let adminMembers:
    | Array<{
        id: string;
        displayName: string;
        debt: number;
        credit: number;
      }>
    | null = null;
  if (isAdmin) {
    const [activeMembers, memberCredits] = await Promise.all([
      listActiveMembers(db),
      listMemberCreditBalances(db),
    ]);
    const debts = await Promise.all(
      activeMembers.map((mm) => getMemberOutstandingDebt(db, mm.id))
    );
    const creditByUser = new Map(memberCredits.map((c) => [c.userId, c.balance]));
    adminMembers = activeMembers.map((mm, i) => ({
      id: mm.id,
      displayName: mm.displayName,
      debt: debts[i] ?? 0,
      credit: creditByUser.get(mm.id) ?? 0,
    }));
  }

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

      {isAdmin && (
        <div className="mini-grid-2">
          <MiniCard>
            <div style={{ fontSize: 11, color: 'var(--mini-hint)', textTransform: 'uppercase' }}>
              {m.dashboard.cashPot}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: 'var(--mini-text)' }}>
              {formatCents(pots.cash)}
            </div>
          </MiniCard>
          <MiniCard>
            <div style={{ fontSize: 11, color: 'var(--mini-hint)', textTransform: 'uppercase' }}>
              {m.dashboard.cardPot}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: 'var(--mini-text)' }}>
              {formatCents(pots.card)}
            </div>
          </MiniCard>
        </div>
      )}

      {isAdmin && teamCreditLiability > 0 && (
        <MiniCard style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
            {m.wallet.dashboard.liabilityLabel}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
            {formatCents(teamCreditLiability)}
          </div>
        </MiniCard>
      )}

      {!isAdmin && (
        <MiniSection heading={m.dashboard.teamSummary}>
          <MiniRow
            title={<>💵 {m.dashboard.cashPot}</>}
            right={<span>{formatCents(pots.cash)}</span>}
          />
          <MiniRow
            title={<>💳 {m.dashboard.cardPot}</>}
            right={<span>{formatCents(pots.card)}</span>}
          />
        </MiniSection>
      )}

      {isAdmin && adminMembers && (
        <MiniSection heading={m.dashboard.membersHeading(adminMembers.length)}>
          {adminMembers.length === 0 ? (
            <MiniEmpty>{m.common.none}</MiniEmpty>
          ) : (
            adminMembers.map((mm) => (
              <MiniLinkRow
                key={mm.id}
                href={`/mini/members/${mm.id}`}
                title={mm.displayName}
                subtitle={
                  mm.credit > 0 ? (
                    <MiniBadge variant="success">{formatCents(mm.credit)}</MiniBadge>
                  ) : undefined
                }
                right={
                  mm.debt > 0 ? (
                    <MiniBadge variant="danger">{m.common.owesAmount(formatCents(mm.debt))}</MiniBadge>
                  ) : (
                    <MiniBadge variant="success">{m.members.settledBadge}</MiniBadge>
                  )
                }
              />
            ))
          )}
        </MiniSection>
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
        {isAdmin && (
          <MiniLinkRow
            href="/mini/history"
            title={<span style={{ color: 'var(--mini-link)' }}>{m.dashboard.viewHistory} →</span>}
          />
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
