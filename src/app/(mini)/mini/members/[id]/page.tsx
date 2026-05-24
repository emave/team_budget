import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getUserById } from '@/server/domain/users';
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
import { formatDate, formatPeriodLong, getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniTabs } from '../../tabs';
import { MiniBack } from '../../../_components/mini-back';
import { MiniCard } from '../../../_components/mini-card';
import { MiniSection } from '../../../_components/mini-section';
import { MiniRow } from '../../../_components/mini-row';
import { MiniEmpty } from '../../../_components/mini-empty';
import { MiniChargeDuesForm } from './charge-dues-form';

export default async function MiniMemberDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const me = await requireUser();
  const db = getDb();
  const u = await getUserById(db, params.id);
  if (!u) notFound();

  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const [debt, openCharges, prepaid, payments, credit, creditEvents] = await Promise.all([
    getMemberOutstandingDebt(db, u.id),
    listOpenChargesForMember(db, u.id),
    listPrepaidMonthlyDues(db, u.id),
    listPaymentsByPayer(db, u.id),
    getCreditBalance(db, u.id),
    listCreditHistory(db, u.id),
  ]);

  const isAdmin = me.role === 'admin';
  const settings = isAdmin ? await getOrCreateSettings(db) : null;

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/members">{m.mini.back}</MiniBack>

      <h2 style={{ fontSize: 20, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {u.displayName}
        {!u.isActive && (
          <span style={{ color: 'var(--mini-hint)', fontSize: 14 }}>
            {' '}
            {m.common.inactive}
          </span>
        )}
      </h2>

      <MiniCard
        variant={debt > 0 ? 'debt' : 'settled'}
        style={{ marginBottom: 12 }}
      >
        <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
          {debt > 0 ? m.mini.youOwe : m.mini.settled}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>
          {debt > 0 ? formatCents(debt) : m.members.settledBadge}
        </div>
      </MiniCard>

      {credit > 0 && (
        <MiniCard style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
            {m.mini.creditBalance}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {formatCents(credit)}
          </div>
        </MiniCard>
      )}

      <MiniSection heading={m.mini.openCharges}>
        {openCharges.length === 0 ? (
          <MiniEmpty>{m.common.none}</MiniEmpty>
        ) : (
          openCharges.map((c) => (
            <MiniRow
              key={c.id}
              title={c.description}
              subtitle={<span>{formatDate(c.createdAt, locale)}</span>}
              right={<span>{formatCents(c.amount)}</span>}
            />
          ))
        )}
      </MiniSection>

      {prepaid.length > 0 && (
        <MiniSection heading={m.members.prepaid.heading}>
          <div className="mini-chip-list" style={{ padding: '8px 0' }}>
            {prepaid.map((c) => (
              <span key={c.id} className="mini-chip">
                {formatPeriodLong(c.billingPeriod ?? '', locale)}
              </span>
            ))}
          </div>
        </MiniSection>
      )}

      <MiniSection heading={m.wallet.section.heading}>
        {creditEvents.length === 0 ? (
          <MiniEmpty>{m.mini.walletEmpty}</MiniEmpty>
        ) : (
          creditEvents.map((e, i) => {
            let title = '';
            if (e.kind === 'payment_deposit') {
              title = m.wallet.historyEvent.payment_deposit(
                formatCents(e.amount),
                e.method === 'cash' ? m.common.cash : m.common.card,
              );
            } else if (e.kind === 'payment_consumption') {
              title = m.wallet.historyEvent.payment_consumption(
                formatCents(e.amount),
                e.chargeDescription,
              );
            } else if (e.kind === 'refund') {
              title = m.wallet.historyEvent.refund(
                formatCents(e.amount),
                e.method === 'cash' ? m.common.cash : m.common.card,
              );
            } else if (e.kind === 'transfer_in') {
              title = m.wallet.historyEvent.transfer_in(
                formatCents(e.amount),
                e.counterpartyDisplayName,
              );
            } else {
              title = m.wallet.historyEvent.transfer_out(
                formatCents(e.amount),
                e.counterpartyDisplayName,
              );
            }
            return (
              <MiniRow
                key={i}
                title={title}
                subtitle={<span>{formatDate(e.occurredAt, locale)}</span>}
              />
            );
          })
        )}
      </MiniSection>

      <MiniSection heading={m.mini.paymentHistory}>
        {payments.length === 0 ? (
          <MiniEmpty>{m.common.none}</MiniEmpty>
        ) : (
          payments.map((p) => (
            <MiniRow
              key={p.id}
              title={
                <>
                  {p.method === 'cash' ? '💵' : '💳'}{' '}
                  {p.method === 'cash' ? m.common.methodCash : m.common.methodCard}
                </>
              }
              subtitle={<span>{formatDate(p.receivedAt, locale)}</span>}
              right={<span>{formatCents(p.amount)}</span>}
            />
          ))
        )}
      </MiniSection>

      {isAdmin && settings && (
        <MiniSection heading={m.members.dues.heading}>
          <div style={{ padding: '8px 0' }}>
            <MiniChargeDuesForm
              userId={u.id}
              monthlyDuesAmount={settings.monthlyDuesAmount}
            />
          </div>
        </MiniSection>
      )}

      <MiniTabs />
    </>
  );
}
