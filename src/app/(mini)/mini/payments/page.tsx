import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';

export default async function MiniPaymentsPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listPaymentsByPayer(db, user.id);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.mini.yourPayments}
      </h2>
      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          rows.map((p) => {
            const isCash = p.method === 'cash';
            const methodLabel = isCash ? m.common.methodCash : m.common.methodCard;
            const icon = isCash ? '💵' : '💳';
            return (
              <MiniRow
                key={p.id}
                title={
                  <>
                    {icon} {methodLabel}
                  </>
                }
                subtitle={<span>{formatDate(p.receivedAt, locale)}</span>}
                right={<span>{formatCents(p.amount)}</span>}
              />
            );
          })
        )}
      </MiniSection>
      <MiniTabs />
    </>
  );
}
