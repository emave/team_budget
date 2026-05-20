import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniPaymentsPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listPaymentsByPayer(db, user.id);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{m.mini.yourPayments}</h2>
      <div>
        {rows.map((p) => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 4px', borderTop: '1px solid #f3f4f6', fontSize: 13,
          }}>
            <span>{formatDate(p.receivedAt, locale)} · {p.method}</span>
            <span>{formatCents(p.amount, settings.currency)}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>{m.mini.none}</div>}
      </div>
      <MiniTabs />
    </>
  );
}
