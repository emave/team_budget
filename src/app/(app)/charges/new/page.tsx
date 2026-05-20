import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { NewChargeTabs } from './new-charge-tabs';

export default async function NewChargePage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <div>
      <h2>{m.charges.newPageTitle}</h2>
      <NewChargeTabs members={members.map((mm) => ({ id: mm.id, displayName: mm.displayName }))} />
    </div>
  );
}
