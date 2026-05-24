import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/server-helpers';

export default async function HomePage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  redirect('/dashboard');
}
