'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';

export function Panel({
  children,
  marginBottom = 0,
}: {
  children: ReactNode;
  marginBottom?: number | string;
}) {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        backgroundColor: theme.colors.backgroundPrimary,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale700,
        marginBottom: typeof marginBottom === 'number' ? `${marginBottom}px` : marginBottom,
      })}
    >
      {children}
    </div>
  );
}
