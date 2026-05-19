import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listCategories } from '@/server/domain/categories';
import { RecordSpendingForm } from './record-form';

export default async function NewSpendingPage() {
  await requireAdmin();
  const db = getDb();
  const cats = await listCategories(db);
  return (
    <div>
      <h2>Record spending</h2>
      <RecordSpendingForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
