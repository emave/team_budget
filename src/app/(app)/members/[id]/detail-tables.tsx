'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';

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
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard key={r.id} title={r.description} titleRight={r.amountFormatted} />
      ))}
    </DataList>
  );
}

export function PaymentHistoryTable({ rows }: { rows: PaymentHistoryRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.method}
          titleRight={r.amountFormatted}
          subtitle={r.whenFormatted}
        />
      ))}
    </DataList>
  );
}
