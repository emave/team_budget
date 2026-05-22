import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMoneyMovements } from '@/server/domain/movements';
import { getOrCreateSettings } from '@/server/domain/settings';
import {
  getCreditBalance,
  getTotalCreditLiability,
  listMemberCreditBalances,
} from '@/server/domain/credit';
import { resolveDashboardRange } from '@/shared/date-range';
import { formatCents } from '@/shared/format';
import { getMessages } from '@/shared/i18n';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { Muted } from '@/ui/text';
import { PotCard } from './pot-card';
import { MoneyHistory } from './money-history';
import { MembersTable, type MemberRow } from '../members/members-table';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  if (user.role === 'admin') {
    const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
    const [pots, members, movements, totalCreditLiability, memberCredits] = await Promise.all([
      getPotBalances(db),
      listActiveMembers(db),
      listMoneyMovements(db, { from: range.from, to: range.to }),
      getTotalCreditLiability(db),
      listMemberCreditBalances(db),
    ]);
    const debts = await Promise.all(members.map((mm) => getMemberOutstandingDebt(db, mm.id)));
    const creditByUser = new Map(memberCredits.map((c) => [c.userId, c.balance]));

    const memberRows: MemberRow[] = members.map((mm, i) => {
      const debt = debts[i] ?? 0;
      const credit = creditByUser.get(mm.id) ?? 0;
      return {
        id: mm.id,
        displayName: mm.displayName,
        role: mm.role as 'admin' | 'member',
        isActive: true,
        debtFormatted: debt > 0 ? formatCents(debt) : null,
        creditFormatted: credit > 0 ? formatCents(credit) : null,
      };
    });

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
          <PotCard label={m.dashboard.cardPot} cents={pots.card} />
        </div>
        {totalCreditLiability > 0 && (
          <Panel>
            <Muted>
              {m.wallet.dashboard.liabilityLabel}: {formatCents(totalCreditLiability)}
            </Muted>
          </Panel>
        )}
        <Panel>
          <SectionHeading>{m.dashboard.membersHeading(members.length)}</SectionHeading>
          <MembersTable rows={memberRows} />
        </Panel>
        <MoneyHistory
          movements={movements}
          range={{ from: range.from, to: range.to }}
          clamped={range.clamped}
        />
      </div>
    );
  }

  const [debt, pots, creditBalance, settings] = await Promise.all([
    getMemberOutstandingDebt(db, user.id),
    getPotBalances(db),
    getCreditBalance(db, user.id),
    getOrCreateSettings(db),
  ]);
  const dues = settings.monthlyDuesAmount;
  const monthsCovered = dues > 0 ? Math.floor(creditBalance / dues) : 0;
  return (
    <div>
      <StatusCard
        tone={debt > 0 ? 'negative' : 'positive'}
        caption={debt > 0 ? m.dashboard.youOwe(user.displayName) : m.dashboard.youSettled(user.displayName)}
        value={formatCents(debt)}
      />
      {creditBalance > 0 && (
        <Panel>
          <SectionHeading>{m.wallet.title}</SectionHeading>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{formatCents(creditBalance)}</div>
          {monthsCovered > 0 && dues > 0 ? (
            <Muted>{m.wallet.coversMonths(monthsCovered, formatCents(dues))}</Muted>
          ) : null}
        </Panel>
      )}
      <Panel>
        <SectionHeading>{m.dashboard.teamSummary}</SectionHeading>
        <Muted>
          {m.dashboard.potsLine(formatCents(pots.cash), formatCents(pots.card))}
        </Muted>
      </Panel>
    </div>
  );
}
