import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getOrCreateSettings } from '@/server/domain/settings';
import { listCategories } from '@/server/domain/categories';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniBack } from '../../_components/mini-back';
import { MiniSection } from '../../_components/mini-section';
import { DuesForm } from './dues-form';
import { PotOpeningsForm } from './pot-openings-form';
import { CategoriesList } from './categories-list';

export default async function MiniSettingsPage() {
  await requireAdmin();
  const db = getDb();
  const s = await getOrCreateSettings(db);
  const cats = await listCategories(db, { includeArchived: true });
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/more">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.settings.title}
      </h2>

      <MiniSection heading={m.settings.monthlyDuesHeading}>
        <DuesForm currentCents={s.monthlyDuesAmount} />
      </MiniSection>

      <MiniSection heading={m.settings.potOpeningsHeading}>
        <PotOpeningsForm cashCents={s.cashOpeningCents} cardCents={s.cardOpeningCents} />
      </MiniSection>

      <MiniSection heading={m.settings.categoriesHeading}>
        <CategoriesList
          categories={cats.map((c) => ({ id: c.id, name: c.name, archived: c.archived }))}
        />
      </MiniSection>

      <MiniTabs />
    </>
  );
}
