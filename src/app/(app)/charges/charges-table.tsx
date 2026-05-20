'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted, StatusBadge } from '@/ui/text';
import { CancelChargeButton } from './cancel-button';
import type { Messages } from '@/shared/i18n';

export interface ChargeRow {
  id: string;
  type: string;
  description: string;
  userDisplayName: string;
  amountFormatted: string;
  status: 'open' | 'paid' | 'cancelled' | string;
  whenFormatted: string;
  showCancel: boolean;
}

const TYPE_KEYS: Record<string, keyof Messages['charges']> = {
  adhoc: 'typeAdhoc',
  split: 'typeSplit',
  pot_borrow: 'typePotBorrow',
  monthly_dues: 'typeMonthlyDues',
  out_of_bounds: 'typeOutOfBounds',
};

const STATUS_KEYS: Record<string, keyof Messages['charges']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

export function ChargesTable({ rows }: { rows: ChargeRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.charges.none}>
      <TableBuilderColumn header={m.charges.colType}>
        {(r: ChargeRow) => <Muted>{TYPE_KEYS[r.type] ? (m.charges[TYPE_KEYS[r.type]!] as string) : r.type}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.charges.colDescription}>
        {(r: ChargeRow) => <>{r.description} — {r.userDisplayName}</>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.charges.colAmount} numeric>
        {(r: ChargeRow) => r.amountFormatted}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.charges.colStatus}>
        {(r: ChargeRow) => {
          const label = STATUS_KEYS[r.status] ? (m.charges[STATUS_KEYS[r.status]!] as string) : r.status;
          const tone = r.status === 'paid' ? 'positive' : r.status === 'open' ? 'negative' : 'neutral';
          return <StatusBadge tone={tone}>{label}</StatusBadge>;
        }}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.charges.colWhen}>
        {(r: ChargeRow) => <Muted>{r.whenFormatted}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.common.colActions}>
        {(r: ChargeRow) => (r.showCancel ? <CancelChargeButton id={r.id} /> : null)}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
