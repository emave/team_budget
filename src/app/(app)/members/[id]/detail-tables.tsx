'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted } from '@/ui/text';

export interface OpenChargeRow {
  id: string;
  description: string;
  amountFormatted: string;
}

export interface PaymentHistoryRow {
  id: string;
  whenFormatted: string;
  method: string;
  amountFormatted: string;
}

export function OpenChargesTable({ rows }: { rows: OpenChargeRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.common.none}>
      <TableBuilderColumn header={m.common.colDescription}>
        {(r: OpenChargeRow) => r.description}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.common.colAmount} numeric>
        {(r: OpenChargeRow) => r.amountFormatted}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

export function PaymentHistoryTable({ rows }: { rows: PaymentHistoryRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.common.none}>
      <TableBuilderColumn header={m.common.colWhen}>
        {(r: PaymentHistoryRow) => <Muted>{r.whenFormatted}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.payments.colMethod}>
        {(r: PaymentHistoryRow) => <Muted>{r.method}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.common.colAmount} numeric>
        {(r: PaymentHistoryRow) => r.amountFormatted}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
