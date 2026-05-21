import type { ReactNode } from 'react';

export function MiniEmpty({ children }: { children: ReactNode }) {
  return <div className="mini-empty">{children}</div>;
}
