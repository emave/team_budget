import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { users } from '@/server/db/schema';
import Link from 'next/link';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { InviteButton } from './invite-button';

export default async function MembersPage() {
  const me = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const all = db.select().from(users).all();
  const debts = await Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id)));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{m.members.title}</h2>
        {me.role === 'admin' && <InviteButton />}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        {all.map((u, i) => (
          <Link
            key={u.id}
            href={`/members/${u.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderTop: '1px solid #f3f4f6',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span>
              {u.displayName}{m.common.sep}{u.role}
              {!u.isActive && ` ${m.common.inactive}`}
            </span>
            <span style={{ color: (debts[i] ?? 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
              {(debts[i] ?? 0) > 0 ? m.common.owesAmount(formatCents(debts[i] ?? 0, settings.currency)) : m.common.settled}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
