import { redirect } from 'next/navigation';
import { bootOnce } from '@/server/boot';
import { getCurrentUser } from '@/server/auth/server-helpers';

export default async function HomePage() {
  await bootOnce();
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  redirect('/dashboard');
}
