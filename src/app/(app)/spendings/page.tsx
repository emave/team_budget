import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listSpendings } from '@/server/domain/spendings';
import { listCategories } from '@/server/domain/categories';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { LinkButton } from '@/ui/link-button';
import { ActionNewIcon } from '@/ui/icons';
import { SpendingsTable, type SpendingRow } from './spendings-table';

export default async function SpendingsPage() {
  const me = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listSpendings(db);
  const cats = new Map((await listCategories(db, { includeArchived: true })).map((c) => [c.id, c.name]));
  rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  const shaped: SpendingRow[] = rows.map((s) => ({
    id: s.id,
    pot: s.pot,
    description: s.description,
    category: s.categoryId ? cats.get(s.categoryId) ?? '' : '',
    amountFormatted: formatCents(s.amount),
    whenFormatted: formatDateTime(s.occurredAt, locale),
    cancelled: Boolean(s.cancelledAt),
    showCancel: me.role === 'admin' && !s.cancelledAt,
  }));

  return (
    <div>
      <PageHeader
        title={m.spendings.title}
        subtitle={m.spendings.subtitle}
        actions={
          me.role === 'admin' ? (
            <LinkButton href="/spendings/new" startEnhancer={<ActionNewIcon />}>
              {m.spendings.record}
            </LinkButton>
          ) : null
        }
      />
      <Panel>
        <SpendingsTable rows={shaped} />
      </Panel>
    </div>
  );
}
