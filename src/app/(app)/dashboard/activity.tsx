import { formatCents } from '@/shared/format';
import { formatDateTime, getMessages, type Locale } from '@/shared/i18n';
import type { ActivityEvent } from '@/server/domain/activity';

export function ActivityFeed({
  events,
  currency,
  locale,
}: {
  events: ActivityEvent[];
  currency: string;
  locale: Locale;
}) {
  const m = getMessages(locale);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginTop: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 12 }}>{m.dashboard.activityHeading}</h3>
      {events.length === 0 && <div style={{ color: '#6b7280' }}>{m.dashboard.noActivity}</div>}
      {events.map((e) => (
        <div
          key={`${e.kind}-${e.id}`}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 13 }}
        >
          <span>
            {e.kind === 'charge' && m.dashboard.chargeLine(formatCents(e.amount, currency), e.userDisplayName, e.description)}
            {e.kind === 'payment' && m.dashboard.paymentLine(e.payerDisplayName, formatCents(e.amount, currency), e.method)}
            {e.kind === 'spending' && m.dashboard.spendingLine(formatCents(e.amount, currency), e.pot, e.description)}
          </span>
          <span style={{ color: '#6b7280' }}>{formatDateTime(e.createdAt, locale)}</span>
        </div>
      ))}
    </div>
  );
}
