'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';
import { HeadingMedium, LabelSmall } from 'baseui/typography';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
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
      <div className={css({ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 })}>
        <HeadingMedium marginTop="0" marginBottom="0">{title}</HeadingMedium>
        {subtitle ? (
          <LabelSmall color={theme.colors.contentSecondary}>{subtitle}</LabelSmall>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
