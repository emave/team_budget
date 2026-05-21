import type { ReactNode, CSSProperties } from 'react';

type Variant = 'default' | 'debt' | 'settled';

export function MiniCard({
  children,
  variant = 'default',
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  style?: CSSProperties;
}) {
  const cls =
    'mini-card' +
    (variant === 'debt' ? ' mini-card--debt' : variant === 'settled' ? ' mini-card--settled' : '');
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
