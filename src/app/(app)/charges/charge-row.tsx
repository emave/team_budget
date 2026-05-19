import type { ReactNode } from 'react';
import { formatCents } from '@/shared/format';

export function ChargeRow({
  type,
  description,
  amount,
  status,
  createdAt,
  userDisplayName,
  currency,
  actions,
}: {
  type: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  userDisplayName: string;
  currency: string;
  actions?: ReactNode;
}) {
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
      <span style={{ color: '#6b7280' }}>{type}</span>
      <span>{description} — {userDisplayName}</span>
      <span>{formatCents(amount, currency)}</span>
      <span style={{ color: status === 'paid' ? '#16a34a' : status === 'cancelled' ? '#6b7280' : '#dc2626' }}>{status}</span>
      <span style={{ color: '#6b7280' }}>{new Date(createdAt).toLocaleString()}</span>
      <span>{actions}</span>
    </div>
  );
}
