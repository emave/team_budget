import Link from 'next/link';
import type { ReactNode } from 'react';
import { MiniRow } from './mini-row';

export function MiniLinkRow({
  href,
  title,
  subtitle,
  right,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Link href={href} className="mini-link-row">
      <MiniRow
        title={title}
        subtitle={subtitle}
        right={
          <>
            {right}
            <span className="mini-link-row__chevron" aria-hidden>›</span>
          </>
        }
      />
    </Link>
  );
}
