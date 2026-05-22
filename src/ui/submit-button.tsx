'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from 'baseui/button';

export function SubmitButton({
  children,
  ...rest
}: ButtonProps & { children: ReactNode }) {
  return (
    <Button
      {...rest}
      overrides={{
        ...rest.overrides,
        BaseButton: {
          style: { width: '100%' },
        },
      }}
    >
      {children}
    </Button>
  );
}
