'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
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
    <DataList emptyMessage={m.payments.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.payerDisplayName}
          titleRight={r.amountFormatted}
          subtitle={`${r.method} · ${r.whenFormatted}`}
          badges={
            r.cancelled ? (
              <StatusBadge tone="neutral" icon={<StatusCancelledIcon size={14} />}>
                {m.common.cancelled}
              </StatusBadge>
            ) : null
          }
          inlineAction={r.showCancel ? <CancelPaymentButton id={r.id} /> : null}
        />
      ))}
    </DataList>
  );
}
