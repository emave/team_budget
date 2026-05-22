'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted, StatusBadge } from '@/ui/text';
import { StatusCancelledIcon } from '@/ui/icons';
import { CancelPaymentButton } from './cancel-button';

export interface PaymentRow {
  id: string;
  payerDisplayName: string;
  method: string;
  amountFormatted: string;
  whenFormatted: string;
  cancelled: boolean;
  showCancel: boolean;
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.payments.none}>
      <TableBuilderColumn header={m.payments.colPayer}>
        {(r: PaymentRow) => r.payerDisplayName}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.payments.colMethod}>
        {(r: PaymentRow) => <Muted>{r.method}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.payments.colAmount} numeric>
        {(r: PaymentRow) => r.amountFormatted}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.payments.colWhen}>
        {(r: PaymentRow) =>
          r.cancelled ? (
            <StatusBadge tone="neutral" icon={<StatusCancelledIcon size={14} />}>
              {m.common.cancelled}
            </StatusBadge>
          ) : (
            <Muted>{r.whenFormatted}</Muted>
          )
        }
      </TableBuilderColumn>
      <TableBuilderColumn header={m.common.colActions}>
        {(r: PaymentRow) => (r.showCancel ? <CancelPaymentButton id={r.id} /> : null)}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
