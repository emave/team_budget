import type { ReactNode } from 'react';
import { formatCents } from '@/shared/format';
import { formatDateTime, getMessages, type Locale, type Messages } from '@/shared/i18n';

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

export function ChargeRow({
  type,
  description,
  amount,
  status,
  createdAt,
  userDisplayName,
  currency,
  locale,
  actions,
}: {
  type: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  userDisplayName: string;
  currency: string;
  locale: Locale;
  actions?: ReactNode;
}) {
  const m = getMessages(locale);
  const typeLabel = (TYPE_KEYS[type] && (m.charges[TYPE_KEYS[type]!] as string)) || type;
  const statusLabel = (STATUS_KEYS[status] && (m.charges[STATUS_KEYS[status]!] as string)) || status;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 100px 100px 160px 80px',
        gap: 12,
        padding: '8px 0',
        borderTop: '1px solid #f3f4f6',
        fontSize: 13,
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#6b7280' }}>{typeLabel}</span>
      <span>{description} — {userDisplayName}</span>
      <span>{formatCents(amount, currency)}</span>
      <span style={{ color: status === 'paid' ? '#16a34a' : status === 'cancelled' ? '#6b7280' : '#dc2626' }}>{statusLabel}</span>
      <span style={{ color: '#6b7280' }}>{formatDateTime(createdAt, locale)}</span>
      <span>{actions}</span>
    </div>
  );
}
