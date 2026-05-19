'use client';

import { useState, type ReactNode } from 'react';
import { BaseProvider } from 'baseui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyletronRegistry } from './styletron-registry';
import { lightTheme } from '@/ui/theme';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  }));
  return (
    <StyletronRegistry>
      <BaseProvider theme={lightTheme}>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </BaseProvider>
    </StyletronRegistry>
  );
}
