'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
import { StatusOpenIcon, StatusPaidIcon, StatusCancelledIcon } from '@/ui/icons';
import { CancelChargeButton } from './cancel-button';
import { PayFromCreditButton } from './pay-from-credit-button';
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
  creditAvailableCents?: number;
  remainingCents?: number;
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
    <DataList emptyMessage={m.charges.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const typeLabel = TYPE_KEYS[r.type]
          ? (m.charges[TYPE_KEYS[r.type]!] as string)
          : r.type;
        const statusLabel = STATUS_KEYS[r.status]
          ? (m.charges[STATUS_KEYS[r.status]!] as string)
          : r.status;
        const tone = r.status === 'paid' ? 'positive' : r.status === 'open' ? 'negative' : 'neutral';
        const Icon =
          r.status === 'paid' ? StatusPaidIcon : r.status === 'open' ? StatusOpenIcon : StatusCancelledIcon;
        const canPayFromCredit =
          r.status === 'open' &&
          r.type !== 'monthly_dues' &&
          (r.creditAvailableCents ?? 0) > 0 &&
          (r.remainingCents ?? 0) > 0;
        const actions = canPayFromCredit ? (
          <PayFromCreditButton
            chargeId={r.id}
            remainingCents={r.remainingCents ?? 0}
            creditAvailableCents={r.creditAvailableCents ?? 0}
          />
        ) : null;
        return (
          <DataCard
            key={r.id}
            title={`${r.description} — ${r.userDisplayName}`}
            titleRight={r.amountFormatted}
            inlineAction={r.showCancel ? <CancelChargeButton id={r.id} /> : null}
            subtitle={`${typeLabel} · ${r.whenFormatted}`}
            badges={
              <StatusBadge tone={tone} icon={<Icon size={14} />}>
                {statusLabel}
              </StatusBadge>
            }
            actions={actions}
          />
        );
      })}
    </DataList>
  );
}
