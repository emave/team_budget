import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listActiveMembers } from '@/server/domain/users';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniBack } from '../../../_components/mini-back';
import { RecordPaymentForm } from './record-form';

export default async function MiniNewPaymentPage() {
  await requireAdmin();
  const db = getDb();
  const members = await listActiveMembers(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/payments">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.payments.newPageTitle}
      </h2>
      <RecordPaymentForm
        members={members.map((mm) => ({ id: mm.id, displayName: mm.displayName }))}
      />
    </>
  );
}
