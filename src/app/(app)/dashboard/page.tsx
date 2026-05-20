import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { recentActivity } from '@/server/domain/activity';
import { formatCents } from '@/shared/format';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { Muted } from '@/ui/text';
import { PotCard } from './pot-card';
import { ActivityFeed, type ActivityRow } from './activity';
import { MembersTable, type MemberRow } from '../members/members-table';

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

    const memberRows: MemberRow[] = members.map((mm, i) => {
      const debt = debts[i] ?? 0;
      return {
        id: mm.id,
        displayName: mm.displayName,
        role: mm.role as 'admin' | 'member',
        isActive: true,
        debtFormatted: debt > 0 ? formatCents(debt, settings.currency) : null,
      };
    });

    const activityRows: ActivityRow[] = events.map((e) => {
      const eventText =
        e.kind === 'charge'
          ? m.dashboard.chargeLine(formatCents(e.amount, settings.currency), e.userDisplayName, e.description)
          : e.kind === 'payment'
            ? m.dashboard.paymentLine(e.payerDisplayName, formatCents(e.amount, settings.currency), e.method)
            : m.dashboard.spendingLine(formatCents(e.amount, settings.currency), e.pot, e.description);
      return {
        key: `${e.kind}-${e.id}`,
        event: eventText,
        whenFormatted: formatDateTime(e.createdAt, locale),
      };
    });

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label={m.dashboard.cashPot} cents={pots.cash} currency={settings.currency} />
          <PotCard label={m.dashboard.cardPot} cents={pots.card} currency={settings.currency} />
        </div>
        <Panel>
          <SectionHeading>{m.dashboard.membersHeading(members.length)}</SectionHeading>
          <MembersTable rows={memberRows} />
        </Panel>
        <ActivityFeed rows={activityRows} />
      </div>
    );
  }

  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  return (
    <div>
      <StatusCard
        tone={debt > 0 ? 'negative' : 'positive'}
        caption={debt > 0 ? m.dashboard.youOwe(user.displayName) : m.dashboard.youSettled(user.displayName)}
        value={formatCents(debt, settings.currency)}
      />
      <Panel>
        <SectionHeading>{m.dashboard.teamSummary}</SectionHeading>
        <Muted>
          {m.dashboard.potsLine(
            formatCents(pots.cash, settings.currency),
            formatCents(pots.card, settings.currency),
          )}
        </Muted>
      </Panel>
    </div>
  );
}
