import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { users } from '@/server/db/schema';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { InviteButton } from './invite-button';
import { MembersTable, type MemberRow } from './members-table';

export default async function MembersPage() {
  const me = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const all = db.select().from(users).all();
  const debts = await Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id)));

  const shaped: MemberRow[] = all.map((u, i) => {
    const debt = debts[i] ?? 0;
    return {
      id: u.id,
      displayName: u.displayName,
      role: u.role as 'admin' | 'member',
      isActive: u.isActive,
      debtFormatted: debt > 0 ? formatCents(debt, settings.currency) : null,
    };
  });

  return (
    <div>
      <PageHeader title={m.members.title} actions={me.role === 'admin' ? <InviteButton /> : null} />
      <Panel>
        <MembersTable rows={shaped} />
      </Panel>
    </div>
  );
}
