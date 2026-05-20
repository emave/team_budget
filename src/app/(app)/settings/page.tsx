import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listCategories } from '@/server/domain/categories';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { SectionHeading } from '@/ui/heading';
import { DuesForm } from './dues-form';
import { CategoriesList } from './categories-list';

export default async function SettingsPage() {
  await requireAdmin();
  const db = getDb();
  const s = await getOrCreateSettings(db);
  const cats = await listCategories(db, { includeArchived: true });
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <div>
      <PageHeader title={m.settings.title} />
      <Panel marginBottom={16}>
        <SectionHeading>{m.settings.monthlyDuesHeading}</SectionHeading>
        <DuesForm currentCents={s.monthlyDuesAmount} />
      </Panel>
      <Panel>
        <SectionHeading>{m.settings.categoriesHeading}</SectionHeading>
        <CategoriesList categories={cats.map((c) => ({ id: c.id, name: c.name, archived: c.archived }))} />
      </Panel>
    </div>
  );
}
