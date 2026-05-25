import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { listGuests } from '@/server/domain/guests';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { RecordPaymentForm } from './record-form';

export default async function NewPaymentPage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  const guests = await listGuests(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <div>
      <PageHeader title={m.received.newPageTitle} />
      <RecordPaymentForm
        members={members.map((mm) => ({ id: mm.id, displayName: mm.displayName }))}
        guests={guests.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
