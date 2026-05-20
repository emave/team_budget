import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageEditor } from './page-editor';

export default async function InfoPage() {
  const me = await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  return (
    <div>
      <h2>{m.info.title}</h2>
      {pages.map((p) => (
        <article key={p.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h3>{p.title}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{p.body}</pre>
          {me.role === 'admin' && <PageEditor mode="edit" page={p} />}
        </article>
      ))}
      {me.role === 'admin' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3>{m.info.newEntry}</h3>
          <PageEditor mode="create" />
        </div>
      )}
      {pages.length === 0 && me.role !== 'admin' && <div style={{ color: '#6b7280' }}>{m.info.none}</div>}
    </div>
  );
}
