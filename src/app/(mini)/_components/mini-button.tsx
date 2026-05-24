import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

function classFor(variant: Variant, inline: boolean): string {
  const base = 'mini-button';
  const variantCls =
    variant === 'secondary'
      ? ' mini-button--secondary'
      : variant === 'ghost'
        ? ' mini-button--ghost'
        : variant === 'danger'
          ? ' mini-button--danger'
          : '';
  return base + variantCls + (inline ? ' mini-button--inline' : '');
}

export function MiniButton({
  variant = 'primary',
  inline = false,
  children,
  ...rest
}: { variant?: Variant; inline?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classFor(variant, inline)} {...rest}>
      {children}
    </button>
  );
}

export function MiniLinkButton({
  href,
  variant = 'primary',
  inline = false,
  children,
}: {
  href: string;
  variant?: Variant;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={classFor(variant, inline)}>
      {children}
    </Link>
  );
}
