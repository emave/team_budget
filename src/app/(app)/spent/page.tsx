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
import { SpentTable, type SpendingRow } from './spent-table';

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
        title={m.spent.title}
        subtitle={m.spent.subtitle}
        actions={
          me.role === 'admin' ? (
            <LinkButton href="/spent/new" startEnhancer={<ActionNewIcon />}>
              {m.spent.record}
            </LinkButton>
          ) : null
        }
      />
      <Panel>
        <SpentTable rows={shaped} />
      </Panel>
    </div>
  );
}
