import Link from 'next/link';
import { formatCents } from '@/shared/format';

export function MemberRow({
  id,
  displayName,
  role,
  debt,
  currency,
}: {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  debt: number;
  currency: string;
}) {
  return (
    <Link
      href={`/members/${id}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderTop: '1px solid #f3f4f6',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span>
        {displayName} · {role}
      </span>
      <span style={{ color: debt > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
        {debt > 0 ? `owes ${formatCents(debt, currency)}` : 'settled'}
      </span>
    </Link>
  );
}
