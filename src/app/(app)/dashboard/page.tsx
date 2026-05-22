import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import {
  getCreditBalance,
  getTotalCreditLiability,
  listMemberCreditBalances,
} from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { getMessages } from '@/shared/i18n';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { Muted } from '@/ui/text';
import { PotCard } from './pot-card';
import { MembersTable, type MemberRow } from '../members/members-table';

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  if (user.role === 'admin') {
    const [pots, members, totalCreditLiability, memberCredits] = await Promise.all([
      getPotBalances(db),
      listActiveMembers(db),
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
        <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
        <PotCard label={m.dashboard.cardPot} cents={pots.card} />
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
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/dashboard/history">{m.dashboard.viewHistory}</Link>
        </div>
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
