import type { ReactNode } from 'react';
import Script from 'next/script';
import { requireUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';

export default async function MiniLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  await requireUser();
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?56" strategy="beforeInteractive" />
      <main style={{ padding: 12, maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>{children}</main>
    </>
  );
}
