import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listSpendings } from '@/server/domain/spendings';
import { listCategories } from '@/server/domain/categories';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { CancelSpendingButton } from './cancel-button';

export default async function SpendingsPage() {
  const me = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const rows = await listSpendings(db);
  const cats = new Map((await listCategories(db, { includeArchived: true })).map((c) => [c.id, c.name]));
  rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Spendings</h2>
        {me.role === 'admin' && <Link href="/spendings/new">+ Record spending</Link>}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        {rows.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 120px 100px 160px 80px',
              gap: 12,
              padding: '8px 0',
              borderTop: '1px solid #f3f4f6',
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#6b7280' }}>{s.pot}</span>
            <span>{s.description}</span>
            <span style={{ color: '#6b7280' }}>{s.categoryId ? cats.get(s.categoryId) ?? '' : ''}</span>
            <span>{formatCents(s.amount, settings.currency)}</span>
            <span style={{ color: s.cancelledAt ? '#6b7280' : '#16a34a' }}>
              {s.cancelledAt ? 'cancelled' : new Date(s.occurredAt).toLocaleString()}
            </span>
            <span>{me.role === 'admin' && !s.cancelledAt && <CancelSpendingButton id={s.id} />}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>No spendings.</div>}
      </div>
    </div>
  );
}
