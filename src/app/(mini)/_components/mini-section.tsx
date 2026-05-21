import type { ReactNode } from 'react';

export function MiniSection({ heading, children }: { heading?: ReactNode; children: ReactNode }) {
  return (
    <section className="mini-section">
      {heading && <h2 className="mini-section__heading">{heading}</h2>}
      {children}
    </section>
  );
}
