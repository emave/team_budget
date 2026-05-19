import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { NewChargeTabs } from './new-charge-tabs';

export default async function NewChargePage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  return (
    <div>
      <h2>New charge</h2>
      <NewChargeTabs members={members.map((m) => ({ id: m.id, displayName: m.displayName }))} />
    </div>
  );
}
