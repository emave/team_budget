import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from './init';
import { MiniTabs } from './tabs';

export default async function MiniDashboard() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  return (
    <>
      <MiniInit />
      <div style={{ padding: 16, background: debt > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>
          {debt > 0 ? m.mini.youOwe : m.mini.settled}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: debt > 0 ? '#991b1b' : '#166534' }}>{formatCents(debt, settings.currency)}</div>
      </div>
      {user.role === 'admin' && (
        <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {m.mini.cashCardLine(formatCents(pots.cash, settings.currency), formatCents(pots.card, settings.currency))}
        </div>
      )}
      <MiniTabs />
    </>
  );
}
