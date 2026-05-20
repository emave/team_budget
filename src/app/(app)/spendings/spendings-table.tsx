'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted, StatusBadge } from '@/ui/text';
import { CancelSpendingButton } from './cancel-button';

export interface SpendingRow {
  id: string;
  pot: string;
  description: string;
  category: string;
  amountFormatted: string;
  whenFormatted: string;
  cancelled: boolean;
  showCancel: boolean;
}

export function SpendingsTable({ rows }: { rows: SpendingRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.spendings.none}>
      <TableBuilderColumn header={m.spendings.colPot}>
        {(r: SpendingRow) => <Muted>{r.pot}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.spendings.colDescription}>
        {(r: SpendingRow) => r.description}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.spendings.colCategory}>
        {(r: SpendingRow) => <Muted>{r.category}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.spendings.colAmount} numeric>
        {(r: SpendingRow) => r.amountFormatted}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.spendings.colWhen}>
        {(r: SpendingRow) =>
          r.cancelled ? (
            <StatusBadge tone="neutral">{m.common.cancelled}</StatusBadge>
          ) : (
            <Muted>{r.whenFormatted}</Muted>
          )
        }
      </TableBuilderColumn>
      <TableBuilderColumn header={m.common.colActions}>
        {(r: SpendingRow) => (r.showCancel ? <CancelSpendingButton id={r.id} /> : null)}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
