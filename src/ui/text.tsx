'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';

export function Muted({ children }: { children: ReactNode }) {
  const [css, theme] = useStyletron();
  return <span className={css({ color: theme.colors.contentSecondary })}>{children}</span>;
}

export function Positive({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  const [css, theme] = useStyletron();
  return (
    <span className={css({ color: theme.colors.contentPositive, fontWeight: bold ? 600 : 400 })}>
      {children}
    </span>
  );
}

export function Negative({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  const [css, theme] = useStyletron();
  return (
    <span className={css({ color: theme.colors.contentNegative, fontWeight: bold ? 600 : 400 })}>
      {children}
    </span>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'positive' | 'negative' | 'neutral';
  children: ReactNode;
}) {
  if (tone === 'positive') return <Positive bold>{children}</Positive>;
  if (tone === 'negative') return <Negative bold>{children}</Negative>;
  return <Muted>{children}</Muted>;
}
