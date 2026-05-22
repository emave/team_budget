import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniTabs } from '../../tabs';
import { GuestDepositForm } from './guest-form';

export default async function MiniGuestDepositPage() {
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const guests = await listGuests(db);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.guestDeposits.newPageTitle}
      </h2>
      <GuestDepositForm guests={guests.map((g) => ({ id: g.id, name: g.name }))} />
      <MiniTabs />
    </>
  );
}
