import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { RecordPaymentForm } from './record-form';

export default async function NewPaymentPage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <div>
      <PageHeader title={m.payments.newPageTitle} />
      <RecordPaymentForm members={members.map((mm) => ({ id: mm.id, displayName: mm.displayName }))} />
    </div>
  );
}
