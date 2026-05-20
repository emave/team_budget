'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, KIND, SIZE, type ButtonProps } from 'baseui/button';

export function LinkButton({
  href,
  children,
  kind,
  size,
}: {
  href: string;
  children: ReactNode;
  kind?: ButtonProps['kind'];
  size?: ButtonProps['size'];
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Button kind={kind ?? KIND.primary} size={size ?? SIZE.compact}>
        {children}
      </Button>
    </Link>
  );
}
