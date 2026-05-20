import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniInfoPage() {
  await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{m.mini.infoTitle}</h2>
      {pages.map((p) => (
        <article key={p.id} style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>{p.title}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: 13 }}>{p.body}</pre>
        </article>
      ))}
      {pages.length === 0 && <div style={{ color: '#6b7280' }}>{m.mini.noEntries}</div>}
      <MiniTabs />
    </>
  );
}
