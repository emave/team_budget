import type { ReactNode } from 'react';

export function MiniRow({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mini-row">
      <div className="mini-row__left">
        <span className="mini-row__title">{title}</span>
        {subtitle && <span className="mini-row__subtitle">{subtitle}</span>}
      </div>
      {right && <div className="mini-row__right">{right}</div>}
    </div>
  );
}
