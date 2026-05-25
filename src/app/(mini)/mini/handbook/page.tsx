import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniEmpty } from '../../_components/mini-empty';
import { Markdown } from '../../_components/markdown';

export default async function MiniInfoPage() {
  await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.mini.infoTitle}
      </h2>
      {pages.length === 0 ? (
        <MiniEmpty>{m.mini.noEntries}</MiniEmpty>
      ) : (
        pages.map((p) => (
          <MiniSection key={p.id}>
            <h3 style={{ fontSize: 15, margin: '8px 0 4px', color: 'var(--mini-text)' }}>
              {p.title}
            </h3>
            <Markdown source={p.body} />
          </MiniSection>
        ))
      )}
      <MiniTabs />
    </>
  );
}
