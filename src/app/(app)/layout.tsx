import type { ReactNode } from 'react';
import { requireUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';
import { env } from '@/server/env';
import { AppShell } from './_components/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  const user = await requireUser();
  const e = env();
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: `window.__BOT_USERNAME__=${JSON.stringify(e.BOT_USERNAME)};` }}
      />
      <AppShell displayName={user.displayName} role={user.role}>
        {children}
      </AppShell>
    </>
  );
}
