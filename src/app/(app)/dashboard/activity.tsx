import { formatCents } from '@/shared/format';
import type { ActivityEvent } from '@/server/domain/activity';

export function ActivityFeed({ events, currency }: { events: ActivityEvent[]; currency: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginTop: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 12 }}>Recent activity</h3>
      {events.length === 0 && <div style={{ color: '#6b7280' }}>Nothing yet.</div>}
      {events.map((e) => (
        <div
          key={`${e.kind}-${e.id}`}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 13 }}
        >
          <span>
            {e.kind === 'charge' && `🧾 Charge ${formatCents(e.amount, currency)} → ${e.userDisplayName}: ${e.description}`}
            {e.kind === 'payment' && `💵 ${e.payerDisplayName} paid ${formatCents(e.amount, currency)} (${e.method})`}
            {e.kind === 'spending' && `🛒 ${formatCents(e.amount, currency)} from ${e.pot}: ${e.description}`}
          </span>
          <span style={{ color: '#6b7280' }}>{new Date(e.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
