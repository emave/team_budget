import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { users } from '@/server/db/schema';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { ChargeRow } from './charge-row';
import { CancelChargeButton } from './cancel-button';
import Link from 'next/link';

export default async function ChargesPage({ searchParams }: { searchParams: { status?: 'open' | 'paid' | 'cancelled' } }) {
  const me = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const status = searchParams.status;
  const rows = await listChargesFiltered(db, { status, limit: 200 });
  const userNames = new Map<string, string>();
  for (const u of db.select({ id: users.id, displayName: users.displayName }).from(users).all()) {
    userNames.set(u.id, u.displayName);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{m.charges.title}</h2>
        {me.role === 'admin' && <Link href="/charges/new">{m.charges.newCharge}</Link>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 13 }}>
        <Link href="/charges">{m.charges.filterAll}</Link>
        <Link href="/charges?status=open">{m.charges.filterOpen}</Link>
        <Link href="/charges?status=paid">{m.charges.filterPaid}</Link>
        <Link href="/charges?status=cancelled">{m.charges.filterCancelled}</Link>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        {rows.map((c) => (
          <ChargeRow
            key={c.id}
            type={c.type}
            description={c.description}
            amount={c.amount}
            status={c.status}
            createdAt={c.createdAt}
            userDisplayName={userNames.get(c.userId) ?? '?'}
            currency={settings.currency}
            locale={locale}
            actions={me.role === 'admin' && c.status === 'open' ? <CancelChargeButton id={c.id} /> : null}
          />
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>{m.charges.none}</div>}
      </div>
    </div>
  );
}
