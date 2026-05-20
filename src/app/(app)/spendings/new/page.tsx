import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listCategories } from '@/server/domain/categories';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { RecordSpendingForm } from './record-form';

export default async function NewSpendingPage() {
  await requireAdmin();
  const db = getDb();
  const cats = await listCategories(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <div>
      <h2>{m.spendings.newPageTitle}</h2>
      <RecordSpendingForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
