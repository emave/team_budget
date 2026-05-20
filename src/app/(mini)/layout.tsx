import type { ReactNode } from 'react';
import Script from 'next/script';
import { getCurrentUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';
import { MiniAuthGate } from './mini/auth-gate';

export default async function MiniLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  const user = await getCurrentUser();
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?56" strategy="beforeInteractive" />
      {user ? (
        <main style={{ padding: 12, maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>
          {children}
        </main>
      ) : (
        <MiniAuthGate />
      )}
    </>
  );
}
