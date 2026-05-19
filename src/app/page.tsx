import { bootOnce } from '@/server/boot';

export default async function HomePage() {
  await bootOnce();
  return <main style={{ padding: 24 }}>Team Budget — ready</main>;
}
