import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listAllPayments } from '@/server/domain/payments';
import { users } from '@/server/db/schema';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { LinkButton } from '@/ui/link-button';
import { PaymentsTable, type PaymentRow } from './payments-table';

export default async function PaymentsPage() {
  const me = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listAllPayments(db);
  const names = new Map(db.select({ id: users.id, displayName: users.displayName }).from(users).all().map((u) => [u.id, u.displayName]));

  const shaped: PaymentRow[] = rows.map((p) => ({
    id: p.id,
    payerDisplayName: names.get(p.payerUserId) ?? '?',
    method: p.method,
    amountFormatted: formatCents(p.amount),
    whenFormatted: formatDateTime(p.receivedAt, locale),
    cancelled: Boolean(p.cancelledAt),
    showCancel: me.role === 'admin' && !p.cancelledAt,
  }));

  return (
    <div>
      <PageHeader
        title={m.payments.title}
        actions={me.role === 'admin' ? <LinkButton href="/payments/new">{m.payments.record}</LinkButton> : null}
      />
      <Panel>
        <PaymentsTable rows={shaped} />
      </Panel>
    </div>
  );
}
