import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { guestDepositSummary } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../../init';
import { MiniTabs } from '../../tabs';
import { MiniBack } from '../../../_components/mini-back';

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function MiniGuestDepositsPage(props: {
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const def = defaultRange();
  const from = searchParams?.from ?? def.from;
  const to = searchParams?.to ?? def.to;

  const allGuests = await listGuests(db, { includeArchived: true });
  const summary = await guestDepositSummary(db, { from, to });

  const guestsInRange = new Set(
    summary.map((s) => s.guestId).filter((id): id is string => id !== null)
  );
  const hasAnon = summary.some((s) => s.guestId === null);

  const columns = allGuests
    .filter((g) => guestsInRange.has(g.id))
    .map((g) => ({ id: g.id, label: g.name, archived: g.archived }));

  const dates = [...new Set(summary.map((s) => s.date))].sort().reverse();

  const cells = new Map<string, number>();
  for (const s of summary) cells.set(`${s.date}|${s.guestId ?? ''}`, s.amount);

  const cell = (date: string, guestId: string) => cells.get(`${date}|${guestId}`) ?? 0;
  const dayTotal = (date: string) =>
    columns.reduce((s, c) => s + cell(date, c.id), 0) + (hasAnon ? cell(date, '') : 0);
  const colTotal = (guestId: string) => dates.reduce((s, d) => s + cell(d, guestId), 0);
  const grandTotal = dates.reduce((s, d) => s + dayTotal(d), 0);

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/guests">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--mini-text)' }}>
        {m.guests.depositsPageTitle}
      </h2>
      <div className="mini-history-bar">{m.mini.rangeLabel(from, to)}</div>

      {dates.length === 0 ? (
        <div className="mini-empty">{m.guests.matrixEmpty}</div>
      ) : (
        <div className="mini-matrix-wrap">
          <table className="mini-matrix">
            <thead>
              <tr>
                <th className="mini-matrix__date">—</th>
                {columns.map((c) => (
                  <th key={c.id}>
                    {c.label}
                    {c.archived && (
                      <span style={{ color: 'var(--mini-hint)' }}>
                        {m.guests.archivedSuffix}
                      </span>
                    )}
                  </th>
                ))}
                {hasAnon && <th>{m.guests.anonymous}</th>}
                <th className="mini-matrix__total">{m.guests.matrixDayTotal}</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d}>
                  <td className="mini-matrix__date">{d}</td>
                  {columns.map((c) => (
                    <td key={c.id}>{cell(d, c.id) ? formatCents(cell(d, c.id)) : ''}</td>
                  ))}
                  {hasAnon && <td>{cell(d, '') ? formatCents(cell(d, '')) : ''}</td>}
                  <td className="mini-matrix__total">{formatCents(dayTotal(d))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="mini-matrix__total">{m.guests.matrixGuestTotal}</td>
                {columns.map((c) => (
                  <td key={c.id} className="mini-matrix__total">
                    {formatCents(colTotal(c.id))}
                  </td>
                ))}
                {hasAnon && (
                  <td className="mini-matrix__total">{formatCents(colTotal(''))}</td>
                )}
                <td className="mini-matrix__total">{formatCents(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <MiniTabs />
    </>
  );
}
