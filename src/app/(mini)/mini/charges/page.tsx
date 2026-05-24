import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages, type Messages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { parseChargesStatusParam, type ChargeStatus } from './filter';

const STATUS_LABEL_KEYS: Record<ChargeStatus, keyof Messages['charges']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

const STATUS_VARIANT: Record<ChargeStatus, 'warn' | 'success' | 'neutral'> = {
  open: 'warn',
  paid: 'success',
  cancelled: 'neutral',
};

const TYPE_LABEL_KEYS: Record<string, keyof Messages['charges']> = {
  adhoc: 'typeAdhoc',
  split: 'typeSplit',
  pot_borrow: 'typePotBorrow',
  monthly_dues: 'typeMonthlyDues',
  out_of_bounds: 'typeOutOfBounds',
};

const FILTERS: Array<{ key: 'all' | ChargeStatus; labelKey: keyof Messages['charges'] }> = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'open', labelKey: 'filterOpen' },
  { key: 'paid', labelKey: 'filterPaid' },
  { key: 'cancelled', labelKey: 'filterCancelled' },
];

export default async function MiniChargesPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const status = parseChargesStatusParam(searchParams?.status);
  const rows = await listChargesFiltered(db, { userId: user.id, status, limit: 50 });

  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.mini.yourCharges}
      </h2>

      <div className="mini-filterbar">
        {FILTERS.map((f) => {
          const href = f.key === 'all' ? '/mini/charges' : `/mini/charges?status=${f.key}`;
          const active = (status ?? 'all') === f.key;
          return (
            <Link key={f.key} href={href} data-active={active}>
              {m.charges[f.labelKey] as string}
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
            const typeLabel = typeLabelKey ? (m.charges[typeLabelKey] as string) : c.type;
            const statusLabel =
              STATUS_LABEL_KEYS[statusKey]
                ? ((m.charges[STATUS_LABEL_KEYS[statusKey]] as string) ?? c.status)
                : c.status;
            return (
              <MiniRow
                key={c.id}
                title={c.description}
                subtitle={
                  <>
                    <span>{formatDate(c.createdAt, locale)}</span>
                    <MiniBadge variant="neutral">{typeLabel}</MiniBadge>
                  </>
                }
                right={
                  <>
                    <span>{formatCents(c.amount)}</span>
                    <MiniBadge variant={STATUS_VARIANT[statusKey] ?? 'neutral'}>
                      {statusLabel}
                    </MiniBadge>
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
