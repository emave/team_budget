import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listCategories } from '@/server/domain/categories';
import { DuesForm } from './dues-form';
import { CategoriesList } from './categories-list';

export default async function SettingsPage() {
  await requireAdmin();
  const db = getDb();
  const s = await getOrCreateSettings(db);
  const cats = await listCategories(db, { includeArchived: true });
  return (
    <div>
      <h2>Settings</h2>
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3>Monthly dues</h3>
        <DuesForm currentCents={s.monthlyDuesAmount} currency={s.currency} />
      </section>
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3>Spending categories</h3>
        <CategoriesList categories={cats.map((c) => ({ id: c.id, name: c.name, archived: c.archived }))} />
      </section>
    </div>
  );
}
