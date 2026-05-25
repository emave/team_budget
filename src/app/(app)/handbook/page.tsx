import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { SectionHeading } from '@/ui/heading';
import { Muted } from '@/ui/text';
import { PageEditor } from './page-editor';

export default async function InfoPage() {
  const me = await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  return (
    <div>
      <PageHeader title={m.handbook.title} />
      {pages.map((p) => (
        <div key={p.id} style={{ marginBottom: 16 }}>
          <Panel>
            <SectionHeading>{p.title}</SectionHeading>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{p.body}</pre>
            {me.role === 'admin' && <PageEditor mode="edit" page={p} />}
          </Panel>
        </div>
      ))}
      {me.role === 'admin' && (
        <Panel>
          <SectionHeading>{m.handbook.newEntry}</SectionHeading>
          <PageEditor mode="create" />
        </Panel>
      )}
      {pages.length === 0 && me.role !== 'admin' && (
        <Panel><Muted>{m.handbook.none}</Muted></Panel>
      )}
    </div>
  );
}
