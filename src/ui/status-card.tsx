'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';

export function StatusCard({
  tone,
  caption,
  value,
  children,
}: {
  tone: 'positive' | 'negative' | 'neutral';
  caption?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
}) {
  const [css, theme] = useStyletron();
  const bg =
    tone === 'positive'
      ? theme.colors.backgroundLightPositive
      : tone === 'negative'
        ? theme.colors.backgroundLightNegative
        : theme.colors.backgroundSecondary;
  const fg =
    tone === 'positive'
      ? theme.colors.contentPositive
      : tone === 'negative'
        ? theme.colors.contentNegative
        : theme.colors.contentPrimary;
  return (
    <div
      className={css({
        backgroundColor: bg,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale700,
        marginBottom: theme.sizing.scale600,
      })}
    >
      {caption && (
        <div
          className={css({
            fontSize: '11px',
            textTransform: 'uppercase',
            color: theme.colors.contentSecondary,
            letterSpacing: '0.04em',
          })}
        >
          {caption}
        </div>
      )}
      {value !== undefined && (
        <div
          className={css({
            fontSize: '36px',
            fontWeight: 700,
            color: fg,
            marginTop: theme.sizing.scale100,
          })}
        >
          {value}
        </div>
      )}
      {children && (
        <div
          className={css({
            color: fg,
            fontWeight: 600,
          })}
        >
          {children}
        </div>
      )}
    </div>
  );
}
