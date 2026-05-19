import type { ReactNode } from 'react';
import { requireUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';
import { AppHeader } from './header';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  const user = await requireUser();
  return (
    <div>
      <AppHeader displayName={user.displayName} role={user.role} />
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}>{children}</main>
    </div>
  );
}
