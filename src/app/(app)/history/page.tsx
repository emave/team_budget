import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listMoneyMovements } from '@/server/domain/movements';
import { resolveDashboardRange } from '@/shared/date-range';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { MoneyHistory } from '../dashboard/money-history';

export default async function DashboardHistory(
  props: {
    searchParams: Promise<{ from?: string; to?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/dashboard');
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
  const movements = await listMoneyMovements(db, { from: range.from, to: range.to });
  return (
    <div>
      <PageHeader title={m.dashboard.movementsHeading} />
      <MoneyHistory
        movements={movements}
        range={{ from: range.from, to: range.to }}
        clamped={range.clamped}
      />
    </div>
  );
}
