import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { RecordPaymentForm } from './record-form';

export default async function NewPaymentPage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  return (
    <div>
      <h2>Record payment</h2>
      <RecordPaymentForm members={members.map((m) => ({ id: m.id, displayName: m.displayName }))} />
    </div>
  );
}
