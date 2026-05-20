'use client';

import type { ReactNode } from 'react';
import { HeadingSmall as BaseHeadingSmall } from 'baseui/typography';

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <BaseHeadingSmall marginTop="0" marginBottom="scale400">
      {children}
    </BaseHeadingSmall>
  );
}
