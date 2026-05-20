import Link from 'next/link';
import { formatCents } from '@/shared/format';
import { getMessages, type Locale } from '@/shared/i18n';

export function MemberRow({
  id,
  displayName,
  role,
  debt,
  currency,
  locale,
}: {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  debt: number;
  currency: string;
  locale: Locale;
}) {
  const m = getMessages(locale);
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
        {displayName}{m.common.sep}{role}
      </span>
      <span style={{ color: debt > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
        {debt > 0 ? m.common.owesAmount(formatCents(debt, currency)) : m.common.settled}
      </span>
    </Link>
  );
}
