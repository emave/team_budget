'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useStyletron } from 'baseui';

interface DataCardProps {
  title: ReactNode;
  titleRight?: ReactNode;
  inlineAction?: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  href?: string;
}

export function DataCard({
  title,
  titleRight,
  inlineAction,
  subtitle,
  badges,
  actions,
  href,
}: DataCardProps) {
  const [css, theme] = useStyletron();

  const cardCss = css({
    display: 'block',
    color: 'inherit',
    textDecoration: 'none',
    background: theme.colors.backgroundPrimary,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    padding: '12px 14px',
    marginBottom: '8px',
    ':hover': href ? { background: theme.colors.backgroundSecondary } : {},
    ':focus-visible': { outline: `2px solid ${theme.colors.borderAccent}`, outlineOffset: '2px' },
  });

  const titleRowCss = css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  });

  const titleCss = css({
    fontSize: '15px',
    fontWeight: 500,
    color: theme.colors.contentPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  });

  const rightGroupCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  });

  const titleRightCss = css({
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.contentPrimary,
    whiteSpace: 'nowrap',
  });

  const subtitleCss = css({
    fontSize: '13px',
    color: theme.colors.contentSecondary,
    marginTop: '2px',
  });

  const badgesCss = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  });

  const actionsCss = css({
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
  });

  const inner = (
    <>
      <div className={titleRowCss}>
        <div className={titleCss}>{title}</div>
        {titleRight || inlineAction ? (
          <div className={rightGroupCss}>
            {titleRight ? <div className={titleRightCss}>{titleRight}</div> : null}
            {inlineAction ? (
              <div onClick={(e: MouseEvent) => e.stopPropagation()}>{inlineAction}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      {subtitle ? <div className={subtitleCss}>{subtitle}</div> : null}
      {badges ? <div className={badgesCss}>{badges}</div> : null}
      {actions ? (
        <div className={actionsCss} onClick={(e: MouseEvent) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardCss}>
        {inner}
      </Link>
    );
  }
  return <div className={cardCss}>{inner}</div>;
}
