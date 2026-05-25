import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getUserById, canHardDeleteUser, listActiveMembers } from '@/server/domain/users';
import {
  getMemberOutstandingDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { listPrepaidMonthlyDues } from '@/server/domain/dues';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { getCreditBalance, listCreditHistory } from '@/server/domain/credit';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, formatPeriodLong, getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { AdminControls } from './admin-controls';
import { ChargeDuesForm } from './charge-dues-form';
import { OpenChargesTable, PaymentHistoryTable, type OpenChargeRow, type PaymentHistoryRow } from './detail-tables';
import { WalletSection, type WalletHistoryItem, type WalletTransferOption } from './wallet-section';

export default async function MemberDetail(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await requireUser();
  const db = getDb();
  const u = await getUserById(db, params.id);
  if (!u) notFound();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const debt = await getMemberOutstandingDebt(db, u.id);
  const charges = await listOpenChargesForMember(db, u.id);
  const prepaid = await listPrepaidMonthlyDues(db, u.id);
  const payments = await listPaymentsByPayer(db, u.id);
  const creditBalance = await getCreditBalance(db, u.id);
  const creditEvents = await listCreditHistory(db, u.id);
  const isAdmin = me.role === 'admin';
  const deleteBlockedReason = isAdmin ? await canHardDeleteUser(db, u.id) : null;
  const isSelf = me.id === u.id;
  const transferOptions: WalletTransferOption[] = isAdmin
    ? (await listActiveMembers(db))
        .filter((mm) => mm.id !== u.id)
        .map((mm) => ({ id: mm.id, displayName: mm.displayName }))
    : [];
  const settings = isAdmin ? await getOrCreateSettings(db) : null;

  const walletHistory: WalletHistoryItem[] = creditEvents.map((e): WalletHistoryItem => {
    if (e.kind === 'payment_deposit') {
      return {
        kind: e.kind,
        id: e.paymentId,
        occurredAt: e.occurredAt,
        amount: e.amount,
        description: m.wallet.historyEvent.payment_deposit(
          formatCents(e.amount),
          e.method === 'cash' ? m.common.cash : m.common.card,
        ),
        cancellable: true,
        sourceKind: 'payment',
      };
    }
    if (e.kind === 'payment_consumption') {
      return {
        kind: e.kind,
        id: `${e.paymentId}-${e.chargeId}`,
        occurredAt: e.occurredAt,
        amount: e.amount,
        description: m.wallet.historyEvent.payment_consumption(
          formatCents(e.amount),
          e.chargeDescription,
        ),
        cancellable: false,
        sourceKind: null,
      };
    }
    if (e.kind === 'refund') {
      return {
        kind: e.kind,
        id: e.movementId,
        occurredAt: e.occurredAt,
        amount: e.amount,
        description: m.wallet.historyEvent.refund(
          formatCents(e.amount),
          e.method === 'cash' ? m.common.cash : m.common.card,
        ),
        cancellable: true,
        sourceKind: 'movement',
      };
    }
    if (e.kind === 'transfer_in') {
      return {
        kind: e.kind,
        id: e.paymentId,
        occurredAt: e.occurredAt,
        amount: e.amount,
        description: m.wallet.historyEvent.transfer_in(
          formatCents(e.amount),
          e.counterpartyDisplayName,
        ),
        cancellable: false,
        sourceKind: null,
      };
    }
    return {
      kind: e.kind,
      id: e.movementId,
      occurredAt: e.occurredAt,
      amount: e.amount,
      description: m.wallet.historyEvent.transfer_out(
        formatCents(e.amount),
        e.counterpartyDisplayName,
      ),
      cancellable: true,
      sourceKind: 'movement',
    };
  });

  const openRows: OpenChargeRow[] = charges.map((c) => ({
    id: c.id,
    description: c.description,
    amountFormatted: formatCents(c.amount),
  }));
  const paymentRows: PaymentHistoryRow[] = payments.map((p) => ({
    id: p.id,
    whenFormatted: formatDateTime(p.receivedAt, locale),
    method: p.method,
    amountFormatted: formatCents(p.amount),
  }));

  return (
    <div>
      <PageHeader
        title={u.displayName}
        actions={isAdmin ? (
          <AdminControls
            user={{ id: u.id, displayName: u.displayName, isActive: u.isActive, role: u.role }}
            isSelf={isSelf}
            deleteBlockedReason={deleteBlockedReason}
          />
        ) : null}
      />

      <StatusCard tone={debt > 0 ? 'negative' : 'positive'}>
        {debt > 0 ? m.people.owes(formatCents(debt)) : m.people.settledBadge}
      </StatusCard>

      <Panel marginBottom={16}>
        <SectionHeading>{m.people.openCharges}</SectionHeading>
        <OpenChargesTable rows={openRows} />
      </Panel>

      {prepaid.length > 0 && (
        <Panel marginBottom={16}>
          <SectionHeading>{m.people.prepaid.heading}</SectionHeading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {prepaid.map((c) => (
              <span
                key={c.id}
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#065f46',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {formatPeriodLong(c.billingPeriod ?? '', locale)}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel marginBottom={16}>
        <SectionHeading>{m.wallet.section.heading}</SectionHeading>
        <WalletSection
          isAdmin={isAdmin}
          userId={u.id}
          userDisplayName={u.displayName}
          balance={creditBalance}
          history={walletHistory}
          transferOptions={transferOptions}
        />
      </Panel>

      {isAdmin && settings && (
        <Panel marginBottom={16}>
          <SectionHeading>{m.people.dues.heading}</SectionHeading>
          <ChargeDuesForm userId={u.id} monthlyDuesAmount={settings.monthlyDuesAmount} />
        </Panel>
      )}

      <Panel>
        <SectionHeading>{m.people.paymentHistory}</SectionHeading>
        <PaymentHistoryTable rows={paymentRows} />
      </Panel>
    </div>
  );
}
