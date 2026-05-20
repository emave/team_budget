import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniChargesPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const rows = await listChargesFiltered(db, { userId: user.id, limit: 50 });
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Your charges</h2>
      <div>
        {rows.map((c) => (
          <div key={c.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 4px', borderTop: '1px solid #f3f4f6', fontSize: 13,
          }}>
            <span>{c.description}</span>
            <span style={{ color: c.status === 'paid' ? '#16a34a' : c.status === 'cancelled' ? '#6b7280' : '#dc2626' }}>
              {formatCents(c.amount, settings.currency)} ({c.status})
            </span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>None.</div>}
      </div>
      <MiniTabs />
    </>
  );
}
