import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listAllPayments } from '@/server/domain/payments';
import { getOrCreateSettings } from '@/server/domain/settings';
import { users } from '@/server/db/schema';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { CancelPaymentButton } from './cancel-button';

export default async function PaymentsPage() {
  const me = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listAllPayments(db);
  const names = new Map(db.select({ id: users.id, displayName: users.displayName }).from(users).all().map((u) => [u.id, u.displayName]));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{m.payments.title}</h2>
        {me.role === 'admin' && <Link href="/payments/new">{m.payments.record}</Link>}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        {rows.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 100px 160px 80px',
              gap: 12,
              padding: '8px 0',
              borderTop: '1px solid #f3f4f6',
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <span>{names.get(p.payerUserId) ?? '?'}</span>
            <span>{p.method}</span>
            <span>{formatCents(p.amount, settings.currency)}</span>
            <span style={{ color: p.cancelledAt ? '#6b7280' : '#16a34a' }}>
              {p.cancelledAt ? m.common.cancelled : formatDateTime(p.receivedAt, locale)}
            </span>
            <span>
              {me.role === 'admin' && !p.cancelledAt && <CancelPaymentButton id={p.id} />}
            </span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>{m.payments.none}</div>}
      </div>
    </div>
  );
}
