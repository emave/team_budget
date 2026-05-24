import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listCategories } from '@/server/domain/categories';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniBack } from '../../../_components/mini-back';
import { RecordSpendingForm } from './record-form';

export default async function NewMiniSpendingPage() {
  await requireAdmin();
  const db = getDb();
  const cats = await listCategories(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/spendings">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.spendings.newPageTitle}
      </h2>
      <RecordSpendingForm
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}
