import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered, sumAllocationsForCharge } from '@/server/domain/charges';
import { listMemberCreditBalances } from '@/server/domain/credit';
import { users } from '@/server/db/schema';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages, type Messages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniLinkButton } from '../../_components/mini-button';
import { MiniCancelButton } from '../../_components/mini-cancel-button';
import { parseChargesStatusParam, type ChargeStatus } from './filter';

const STATUS_LABEL_KEYS: Record<ChargeStatus, keyof Messages['owed']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

const STATUS_VARIANT: Record<ChargeStatus, 'warn' | 'success' | 'neutral'> = {
  open: 'warn',
  paid: 'success',
  cancelled: 'neutral',
};

const TYPE_LABEL_KEYS: Record<string, keyof Messages['owed']> = {
  adhoc: 'typeAdhoc',
  split: 'typeSplit',
  pot_borrow: 'typePotBorrow',
  monthly_dues: 'typeMonthlyDues',
  out_of_bounds: 'typeOutOfBounds',
};

const FILTERS: Array<{ key: 'all' | ChargeStatus; labelKey: keyof Messages['owed'] }> = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'open', labelKey: 'filterOpen' },
  { key: 'paid', labelKey: 'filterPaid' },
  { key: 'cancelled', labelKey: 'filterCancelled' },
];

export default async function MiniChargesPage(props: {
  searchParams: Promise<{ status?: string; scope?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';
  const status = parseChargesStatusParam(searchParams?.status);
  const scope: 'mine' | 'all' = isAdmin && searchParams?.scope !== 'mine' ? 'all' : 'mine';
  const userIdFilter = scope === 'all' ? undefined : user.id;

  const rows = await listChargesFiltered(db, { userId: userIdFilter, status, limit: 100 });

  const userNames = new Map<string, string>();
  if (scope === 'all') {
    for (const u of db.select({ id: users.id, displayName: users.displayName }).from(users).all()) {
      userNames.set(u.id, u.displayName);
    }
  }

  let creditByUser = new Map<string, number>();
  let allocatedByCharge = new Map<string, number>();
  if (isAdmin) {
    const credits = await listMemberCreditBalances(db);
    creditByUser = new Map(credits.map((c) => [c.userId, c.balance]));
    for (const c of rows) {
      if (c.status === 'open') {
        allocatedByCharge.set(c.id, await sumAllocationsForCharge(db, c.id));
      }
    }
  }

  function buildHref(next: { status?: ChargeStatus | 'all'; scope?: 'mine' | 'all' }): string {
    const params = new URLSearchParams();
    const finalStatus = next.status ?? (status ?? 'all');
    const finalScope = next.scope ?? scope;
    if (finalStatus !== 'all') params.set('status', finalStatus);
    if (isAdmin && finalScope === 'mine') params.set('scope', 'mine');
    const qs = params.toString();
    return qs ? `/mini/owed?${qs}` : '/mini/owed';
  }

  return (
    <>
      <MiniInit />
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {scope === 'all' ? m.mini.allCharges : m.mini.yourCharges}
        </h2>
        {isAdmin && (
          <MiniLinkButton href="/mini/owed/new" variant="primary" inline>
            {m.mini.newCta}
          </MiniLinkButton>
        )}
      </div>

      {isAdmin && (
        <div className="mini-filterbar" style={{ marginBottom: 8 }}>
          <Link href={buildHref({ scope: 'all' })} data-active={scope === 'all'}>
            {m.mini.allCharges}
          </Link>
          <Link href={buildHref({ scope: 'mine' })} data-active={scope === 'mine'}>
            {m.mini.yourCharges}
          </Link>
        </div>
      )}

      <div className="mini-filterbar">
        {FILTERS.map((f) => {
          const active = (status ?? 'all') === f.key;
          return (
            <Link key={f.key} href={buildHref({ status: f.key })} data-active={active}>
              {m.owed[f.labelKey] as string}
            </Link>
          );
        })}
      </div>

      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          rows.map((c) => {
            const statusKey = c.status as ChargeStatus;
            const typeLabelKey = TYPE_LABEL_KEYS[c.type];
            const typeLabel = typeLabelKey ? (m.owed[typeLabelKey] as string) : c.type;
            const statusLabel = STATUS_LABEL_KEYS[statusKey]
              ? ((m.owed[STATUS_LABEL_KEYS[statusKey]] as string) ?? c.status)
              : c.status;
            const payerName = userNames.get(c.userId);
            const remaining =
              c.status === 'open' ? c.amount - (allocatedByCharge.get(c.id) ?? 0) : 0;
            const credit = creditByUser.get(c.userId) ?? 0;
            const showCancel = isAdmin && c.status === 'open';
            const showCreditHint =
              isAdmin && c.status === 'open' && c.type !== 'monthly_dues' && credit > 0 && remaining > 0;

            return (
              <MiniRow
                key={c.id}
                title={
                  <>
                    {c.description}
                    {payerName && scope === 'all' ? (
                      <span style={{ color: 'var(--mini-hint)' }}> · {payerName}</span>
                    ) : null}
                  </>
                }
                subtitle={
                  <>
                    <span>{formatDate(c.createdAt, locale)}</span>
                    <MiniBadge variant="neutral">{typeLabel}</MiniBadge>
                    {c.status === 'open' && remaining > 0 && remaining !== c.amount && (
                      <span>{m.received.allocRemaining}: {formatCents(remaining)}</span>
                    )}
                    {showCreditHint && (
                      <MiniBadge variant="success">
                        {m.wallet.payFromCreditCta(formatCents(Math.min(credit, remaining)))}
                      </MiniBadge>
                    )}
                  </>
                }
                right={
                  <>
                    <span>{formatCents(c.amount)}</span>
                    <MiniBadge variant={STATUS_VARIANT[statusKey] ?? 'neutral'}>
                      {statusLabel}
                    </MiniBadge>
                    {showCancel && <MiniCancelButton id={c.id} kind="charge" />}
                  </>
                }
              />
            );
          })
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
