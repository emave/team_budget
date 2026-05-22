import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { users } from '@/server/db/schema';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import Link from 'next/link';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { LinkButton } from '@/ui/link-button';
import { ChargesTable, type ChargeRow } from './charges-table';

export default async function ChargesPage({ searchParams }: { searchParams: { status?: 'open' | 'paid' | 'cancelled' } }) {
  const me = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const status = searchParams.status;
  const rows = await listChargesFiltered(db, { status, limit: 200 });
  const userNames = new Map<string, string>();
  for (const u of db.select({ id: users.id, displayName: users.displayName }).from(users).all()) {
    userNames.set(u.id, u.displayName);
  }

  const shaped: ChargeRow[] = rows.map((c) => ({
    id: c.id,
    type: c.type,
    description: c.description,
    userDisplayName: userNames.get(c.userId) ?? '?',
    amountFormatted: formatCents(c.amount),
    status: c.status,
    whenFormatted: formatDateTime(c.createdAt, locale),
    showCancel: me.role === 'admin' && c.status === 'open',
  }));

  return (
    <div>
      <PageHeader
        title={m.charges.title}
        subtitle={m.charges.subtitle}
        actions={me.role === 'admin' ? <LinkButton href="/charges/new">{m.charges.newCharge}</LinkButton> : null}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 13 }}>
        <Link href="/charges">{m.charges.filterAll}</Link>
        <Link href="/charges?status=open">{m.charges.filterOpen}</Link>
        <Link href="/charges?status=paid">{m.charges.filterPaid}</Link>
        <Link href="/charges?status=cancelled">{m.charges.filterCancelled}</Link>
      </div>
      <Panel>
        <ChargesTable rows={shaped} />
      </Panel>
    </div>
  );
}
