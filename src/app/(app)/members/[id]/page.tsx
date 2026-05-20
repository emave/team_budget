import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getUserById } from '@/server/domain/users';
import { getOrCreateSettings } from '@/server/domain/settings';
import {
  getMemberOutstandingDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDateTime, getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { AdminControls } from './admin-controls';
import { OpenChargesTable, PaymentHistoryTable, type OpenChargeRow, type PaymentHistoryRow } from './detail-tables';

export default async function MemberDetail({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const db = getDb();
  const u = await getUserById(db, params.id);
  if (!u) notFound();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const debt = await getMemberOutstandingDebt(db, u.id);
  const charges = await listOpenChargesForMember(db, u.id);
  const payments = await listPaymentsByPayer(db, u.id);

  const openRows: OpenChargeRow[] = charges.map((c) => ({
    id: c.id,
    description: c.description,
    amountFormatted: formatCents(c.amount, settings.currency),
  }));
  const paymentRows: PaymentHistoryRow[] = payments.map((p) => ({
    id: p.id,
    whenFormatted: formatDateTime(p.receivedAt, locale),
    method: p.method,
    amountFormatted: formatCents(p.amount, settings.currency),
  }));

  return (
    <div>
      <PageHeader
        title={u.displayName}
        actions={me.role === 'admin' ? <AdminControls user={{ id: u.id, isActive: u.isActive, role: u.role }} /> : null}
      />

      <StatusCard tone={debt > 0 ? 'negative' : 'positive'}>
        {debt > 0 ? m.members.owes(formatCents(debt, settings.currency)) : m.members.settledBadge}
      </StatusCard>

      <Panel marginBottom={16}>
        <SectionHeading>{m.members.openCharges}</SectionHeading>
        <OpenChargesTable rows={openRows} />
      </Panel>

      <Panel>
        <SectionHeading>{m.members.paymentHistory}</SectionHeading>
        <PaymentHistoryTable rows={paymentRows} />
      </Panel>
    </div>
  );
}
