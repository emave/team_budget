import type { ReactNode } from 'react';

export function MiniBadge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'success' | 'warn' | 'danger' | 'neutral';
}) {
  return <span className={`mini-badge mini-badge--${variant}`}>{children}</span>;
}
