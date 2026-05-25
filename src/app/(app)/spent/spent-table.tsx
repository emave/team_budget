'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
import { StatusCancelledIcon } from '@/ui/icons';
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

export function SpentTable({ rows }: { rows: SpendingRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.spent.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const subtitleParts = [r.pot, r.category, r.whenFormatted].filter(Boolean);
        return (
          <DataCard
            key={r.id}
            title={r.description}
            titleRight={r.amountFormatted}
            subtitle={subtitleParts.join(' · ')}
            badges={
              r.cancelled ? (
                <StatusBadge tone="neutral" icon={<StatusCancelledIcon size={14} />}>
                  {m.common.cancelled}
                </StatusBadge>
              ) : null
            }
            inlineAction={r.showCancel ? <CancelSpendingButton id={r.id} /> : null}
          />
        );
      })}
    </DataList>
  );
}
