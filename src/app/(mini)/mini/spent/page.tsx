import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listSpendings } from '@/server/domain/spendings';
import { listCategories } from '@/server/domain/categories';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniLinkButton } from '../../_components/mini-button';
import { MiniCancelButton } from '../../_components/mini-cancel-button';
import { MiniBack } from '../../_components/mini-back';

export default async function MiniSpendingsPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';

  const rows = await listSpendings(db);
  const cats = new Map(
    (await listCategories(db, { includeArchived: true })).map((c) => [c.id, c.name])
  );
  rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/more">{m.mini.back}</MiniBack>
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {m.spent.title}
        </h2>
        {isAdmin && (
          <MiniLinkButton href="/mini/spent/new" variant="primary" inline>
            {m.mini.recordCta}
          </MiniLinkButton>
        )}
      </div>

      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.spent.none}</MiniEmpty>
        ) : (
          rows.map((s) => {
            const icon = s.pot === 'cash' ? '💵' : '💳';
            const potLabel =
              s.pot === 'cash' ? m.common.methodCash : m.common.methodCard;
            const catName = s.categoryId ? cats.get(s.categoryId) ?? '' : '';
            const cancelled = Boolean(s.cancelledAt);
            return (
              <MiniRow
                key={s.id}
                title={
                  <>
                    {icon} {s.description}
                  </>
                }
                subtitle={
                  <>
                    <span>{formatDate(s.occurredAt, locale)}</span>
                    <MiniBadge variant="neutral">{potLabel}</MiniBadge>
                    {catName && <MiniBadge variant="neutral">{catName}</MiniBadge>}
                    {cancelled && (
                      <MiniBadge variant="neutral">{m.mini.cancelledTag}</MiniBadge>
                    )}
                  </>
                }
                right={
                  <>
                    <span style={cancelled ? { textDecoration: 'line-through' } : undefined}>
                      {formatCents(s.amount)}
                    </span>
                    {isAdmin && !cancelled && (
                      <MiniCancelButton id={s.id} kind="spending" />
                    )}
                  </>
                }
              />
            );
          })
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
