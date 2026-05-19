'use client';

import { useMemo, type ReactNode } from 'react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { lightTheme } from '@/ui/theme';

export function Providers({ children }: { children: ReactNode }) {
  const engine = useMemo(() => {
    if (typeof document === 'undefined') {
      // Server-side fallback for SSR
      return null as any;
    }
    return new Styletron();
  }, []);

  if (!engine) {
    return <>{children}</>;
  }

  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={lightTheme}>{children}</BaseProvider>
    </StyletronProvider>
  );
}
