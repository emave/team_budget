'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';
import { HeadingMedium } from 'baseui/typography';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.sizing.scale600,
      })}
    >
      <HeadingMedium marginTop="0" marginBottom="0">{title}</HeadingMedium>
      {actions}
    </div>
  );
}
