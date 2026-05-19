'use client';

import { useMemo, type ReactNode } from 'react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { lightTheme } from '@/ui/theme';

export function Providers({ children }: { children: ReactNode }) {
  // Styletron's Client engine touches document.head; on the server we render
  // children unwrapped and let the client engine attach during hydration.
  // Plan 2 will swap in the SSR stylesheet collector.
  const engine = useMemo((): Styletron | null => {
    if (typeof document === 'undefined') return null;
    return new Styletron();
  }, []);

  if (!engine) return <>{children}</>;

  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={lightTheme}>{children}</BaseProvider>
    </StyletronProvider>
  );
}
