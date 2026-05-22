'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, KIND, SIZE, type ButtonProps } from 'baseui/button';

export function LinkButton({
  href,
  children,
  kind,
  size,
  startEnhancer,
}: {
  href: string;
  children: ReactNode;
  kind?: ButtonProps['kind'];
  size?: ButtonProps['size'];
  startEnhancer?: ButtonProps['startEnhancer'];
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Button kind={kind ?? KIND.primary} size={size ?? SIZE.compact} startEnhancer={startEnhancer}>
        {children}
      </Button>
    </Link>
  );
}
