import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listMoneyMovements } from '@/server/domain/movements';
import { resolveDashboardRange } from '@/shared/date-range';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniBack } from '../../_components/mini-back';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniBadge } from '../../_components/mini-badge';
import { HistoryRangeForm } from './range-form';

export default async function MiniHistoryPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/mini');
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
  const movements = await listMoneyMovements(db, { from: range.from, to: range.to });

  const byDay = new Map<string, typeof movements>();
  for (const ev of movements) {
    const day = ev.at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(ev);
    byDay.set(day, arr);
  }
  const days = [...byDay.keys()].sort().reverse();

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--mini-text)' }}>
        {m.dashboard.movementsHeading}
      </h2>
      <HistoryRangeForm initialFrom={range.from} initialTo={range.to} />

      {movements.length === 0 ? (
        <MiniEmpty>{m.dashboard.noMovements}</MiniEmpty>
      ) : (
        days.map((day) => {
          const evs = byDay.get(day)!;
          const dayTotal = evs.reduce((s, ev) => {
            const sign = ev.kind === 'withdraw' || ev.kind === 'credit_refund' ? -1 : 1;
            return s + ev.amount * sign;
          }, 0);
          return (
            <MiniSection key={day} heading={`${formatDate(day, locale)}  •  ${formatCents(dayTotal)}`}>
              {evs.map((ev) => {
                const isOutflow = ev.kind === 'withdraw' || ev.kind === 'credit_refund';
                const sign = isOutflow ? '−' : '+';
                let title: React.ReactNode = '';
                let badge: React.ReactNode = null;
                if (ev.kind === 'deposit') {
                  title = (
                    <>
                      {ev.method === 'cash' ? '💵' : '💳'} {ev.payerDisplayName}
                    </>
                  );
                  badge = (
                    <MiniBadge variant="neutral">
                      {ev.method === 'cash' ? m.common.methodCash : m.common.methodCard}
                    </MiniBadge>
                  );
                } else if (ev.kind === 'guest_deposit') {
                  title = (
                    <>
                      👤 {ev.guestName ?? m.guests.anonymous}
                    </>
                  );
                  badge = (
                    <MiniBadge variant="neutral">
                      {ev.method === 'cash' ? m.common.methodCash : m.common.methodCard}
                    </MiniBadge>
                  );
                } else if (ev.kind === 'withdraw') {
                  title = (
                    <>
                      🛒 {ev.description}
                    </>
                  );
                  badge = (
                    <MiniBadge variant="neutral">
                      {ev.pot === 'cash' ? m.common.methodCash : m.common.methodCard}
                    </MiniBadge>
                  );
                } else {
                  title = (
                    <>
                      ↩️ {ev.userDisplayName}
                    </>
                  );
                  badge = (
                    <MiniBadge variant="neutral">
                      {ev.method === 'cash' ? m.common.methodCash : m.common.methodCard}
                    </MiniBadge>
                  );
                }
                return (
                  <MiniRow
                    key={`${ev.kind}-${ev.id}`}
                    title={title}
                    subtitle={badge}
                    right={
                      <span style={{ color: isOutflow ? 'var(--mini-danger-fg)' : 'var(--mini-success-fg)' }}>
                        {sign}
                        {formatCents(ev.amount)}
                      </span>
                    }
                  />
                );
              })}
            </MiniSection>
          );
        })
      )}

      <MiniTabs />
    </>
  );
}
