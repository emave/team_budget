'use client';

import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';

export interface MatrixData {
  from: string;
  to: string;
  dates: string[];
  columns: { id: string; label: string; archived: boolean }[];
  hasAnon: boolean;
  cells: Record<string, number>;
}

export function Matrix({ data }: { data: MatrixData }) {
  const m = useMessages();
  if (data.dates.length === 0) {
    return <p style={{ padding: 16, color: '#666' }}>{m.guests.matrixEmpty}</p>;
  }
  const cell = (date: string, guestId: string) => data.cells[`${date}|${guestId}`] ?? 0;
  const dayTotal = (date: string) =>
    data.columns.reduce((s, c) => s + cell(date, c.id), 0) + (data.hasAnon ? cell(date, '') : 0);
  const colTotal = (guestId: string) =>
    data.dates.reduce((s, d) => s + cell(d, guestId), 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={th}>—</th>
            {data.columns.map((c) => (
              <th key={c.id} style={th}>
                {c.label}{c.archived && <span style={{ color: '#999' }}>{m.guests.archivedSuffix}</span>}
              </th>
            ))}
            {data.hasAnon && <th style={th}>{m.guests.anonymous}</th>}
            <th style={th}>{m.guests.matrixDayTotal}</th>
          </tr>
        </thead>
        <tbody>
          {data.dates.map((date) => (
            <tr key={date}>
              <td style={td}>{date}</td>
              {data.columns.map((c) => (
                <td key={c.id} style={tdNum}>{cell(date, c.id) ? formatCents(cell(date, c.id)) : ''}</td>
              ))}
              {data.hasAnon && (
                <td style={tdNum}>{cell(date, '') ? formatCents(cell(date, '')) : ''}</td>
              )}
              <td style={tdNumBold}>{formatCents(dayTotal(date))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={tdBold}>{m.guests.matrixGuestTotal}</td>
            {data.columns.map((c) => (
              <td key={c.id} style={tdNumBold}>{formatCents(colTotal(c.id))}</td>
            ))}
            {data.hasAnon && <td style={tdNumBold}>{formatCents(colTotal(''))}</td>}
            <td style={tdNumBold}>
              {formatCents(data.dates.reduce((s, d) => s + dayTotal(d), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #eee', fontWeight: 600, fontSize: 13 };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f4f4f4', fontSize: 14 };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdBold: React.CSSProperties = { ...td, fontWeight: 600 };
const tdNumBold: React.CSSProperties = { ...tdNum, fontWeight: 600 };
