import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listAllPayments, listPaymentsByPayer } from '@/server/domain/payments';
import { users } from '@/server/db/schema';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniLinkButton } from '../../_components/mini-button';
import { MiniCancelButton } from '../../_components/mini-cancel-button';

export default async function MiniPaymentsPage(props: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';
  const scope: 'mine' | 'all' = isAdmin && searchParams?.scope !== 'mine' ? 'all' : 'mine';

  const rows =
    scope === 'all' ? await listAllPayments(db) : await listPaymentsByPayer(db, user.id);

  const userNames = new Map<string, string>();
  if (scope === 'all') {
    for (const u of db.select({ id: users.id, displayName: users.displayName }).from(users).all()) {
      userNames.set(u.id, u.displayName);
    }
  }

  return (
    <>
      <MiniInit />
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {scope === 'all' ? m.mini.allPayments : m.mini.yourPayments}
        </h2>
        {isAdmin && (
          <MiniLinkButton href="/mini/payments/new" variant="primary" inline>
            {m.mini.recordCta}
          </MiniLinkButton>
        )}
      </div>

      {isAdmin && (
        <div className="mini-filterbar">
          <Link href="/mini/payments" data-active={scope === 'all'}>
            {m.mini.allPayments}
          </Link>
          <Link href="/mini/payments?scope=mine" data-active={scope === 'mine'}>
            {m.mini.yourPayments}
          </Link>
          <Link href="/mini/payments/guest" data-active={false}>
            👥 {m.guestDeposits.toggleGuest}
          </Link>
        </div>
      )}

      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          rows.map((p) => {
            const isCash = p.method === 'cash';
            const methodLabel = isCash ? m.common.methodCash : m.common.methodCard;
            const icon = isCash ? '💵' : '💳';
            const payerName = userNames.get(p.payerUserId);
            const cancelled = Boolean(p.cancelledAt);
            return (
              <MiniRow
                key={p.id}
                title={
                  <>
                    {icon} {methodLabel}
                    {payerName && scope === 'all' ? (
                      <span style={{ color: 'var(--mini-hint)' }}> · {payerName}</span>
                    ) : null}
                  </>
                }
                subtitle={
                  <>
                    <span>{formatDate(p.receivedAt, locale)}</span>
                    {cancelled && (
                      <MiniBadge variant="neutral">{m.mini.cancelledTag}</MiniBadge>
                    )}
                  </>
                }
                right={
                  <>
                    <span style={cancelled ? { textDecoration: 'line-through' } : undefined}>
                      {formatCents(p.amount)}
                    </span>
                    {isAdmin && !cancelled && (
                      <MiniCancelButton id={p.id} kind="payment" />
                    )}
                  </>
                }
              />
            );
          })
        )}
      </MiniSection>
      <MiniTabs />
    </>
  );
}
