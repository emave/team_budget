'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';

interface DataListProps {
  children: ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}

export function DataList({ children, emptyMessage, isEmpty }: DataListProps) {
  const [css, theme] = useStyletron();
  if (isEmpty) {
    return (
      <div
        className={css({
          padding: '24px',
          textAlign: 'center',
          color: theme.colors.contentSecondary,
        })}
      >
        {emptyMessage}
      </div>
    );
  }
  return <div>{children}</div>;
}
