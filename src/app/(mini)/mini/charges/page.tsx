import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages, type Messages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

const STATUS_KEYS: Record<string, keyof Messages['charges']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

export default async function MiniChargesPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listChargesFiltered(db, { userId: user.id, limit: 50 });
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{m.mini.yourCharges}</h2>
      <div>
        {rows.map((c) => {
          const statusLabel = (STATUS_KEYS[c.status] && (m.charges[STATUS_KEYS[c.status]!] as string)) || c.status;
          return (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 4px', borderTop: '1px solid #f3f4f6', fontSize: 13,
            }}>
              <span>{c.description}</span>
              <span style={{ color: c.status === 'paid' ? '#16a34a' : c.status === 'cancelled' ? '#6b7280' : '#dc2626' }}>
                {formatCents(c.amount)} ({statusLabel})
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>{m.mini.none}</div>}
      </div>
      <MiniTabs />
    </>
  );
}
