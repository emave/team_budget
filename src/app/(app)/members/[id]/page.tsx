import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getUserById } from '@/server/domain/users';
import { getOrCreateSettings } from '@/server/domain/settings';
import {
  getMemberOutstandingDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { formatCents } from '@/shared/format';
import { AdminControls } from './admin-controls';

export default async function MemberDetail({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const db = getDb();
  const u = await getUserById(db, params.id);
  if (!u) notFound();
  const settings = await getOrCreateSettings(db);
  const debt = await getMemberOutstandingDebt(db, u.id);
  const charges = await listOpenChargesForMember(db, u.id);
  const payments = await listPaymentsByPayer(db, u.id);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{u.displayName}</h2>
        {me.role === 'admin' && <AdminControls user={{ id: u.id, isActive: u.isActive, role: u.role }} />}
      </div>

      <div style={{ background: debt > 0 ? '#fef2f2' : '#f0fdf4', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <strong>{debt > 0 ? `Owes ${formatCents(debt, settings.currency)}` : 'Settled'}</strong>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Open charges</h3>
        {charges.length === 0 && <div style={{ color: '#6b7280' }}>None.</div>}
        {charges.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
            <span>{c.description}</span>
            <span>{formatCents(c.amount, settings.currency)}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Payment history</h3>
        {payments.length === 0 && <div style={{ color: '#6b7280' }}>None.</div>}
        {payments.map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
            <span>{new Date(p.receivedAt).toLocaleString()} — {p.method}</span>
            <span>{formatCents(p.amount, settings.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
