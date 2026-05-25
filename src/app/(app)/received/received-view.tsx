'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tab, Tabs } from 'baseui/tabs-motion';
import { FormControl } from 'baseui/form-control';
import { Select, type Option } from 'baseui/select';
import { DatePicker } from 'baseui/datepicker';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag } from 'baseui/tag';
import { useMutation } from '@tanstack/react-query';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';
import { isoDay } from '@/shared/date-range';
import { cancelPayment } from '@/server/actions/payments-server';
import { cancelGuestDeposit } from '@/server/actions/guest-deposits-server';
import type { DepositSource, UnifiedDeposit } from '@/server/domain/deposits';

type TabId = 'all' | DepositSource;

export interface PersonOption {
  id: string;
  label: string;
  source: DepositSource;
}

interface Props {
  tab: TabId;
  from: string;
  to: string;
  personId: string | null;
  deposits: UnifiedDeposit[];
  memberOptions: PersonOption[];
  guestOptions: PersonOption[];
  isAdmin: boolean;
}

const TAB_KEY: Record<TabId, string> = {
  all: 'all',
  member: 'members',
  guest: 'guests',
};

function tabFromKey(key: string): TabId {
  return key === 'members' ? 'member' : key === 'guests' ? 'guest' : 'all';
}

export function ReceivedView({
  tab,
  from,
  to,
  personId,
  deposits,
  memberOptions,
  guestOptions,
  isAdmin,
}: Props) {
  const m = useMessages();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const buildHref = (next: Partial<{ tab: TabId; from: string; to: string; personId: string | null }>) => {
    const merged = {
      tab: next.tab ?? tab,
      from: next.from ?? from,
      to: next.to ?? to,
      personId: next.personId === undefined ? personId : next.personId,
    };
    const params = new URLSearchParams();
    if (merged.tab !== 'all') params.set('tab', TAB_KEY[merged.tab]);
    params.set('from', merged.from);
    params.set('to', merged.to);
    if (merged.personId) params.set('personId', merged.personId);
    const qs = params.toString();
    return qs ? `/received?${qs}` : '/received';
  };

  const navigate = (next: Partial<{ tab: TabId; from: string; to: string; personId: string | null }>) =>
    startTransition(() => router.push(buildHref(next)));

  const personOptions = useMemo<PersonOption[]>(() => {
    if (tab === 'member') return memberOptions;
    if (tab === 'guest') return guestOptions;
    return [...memberOptions, ...guestOptions];
  }, [tab, memberOptions, guestOptions]);

  const selectValue: Option[] = useMemo(() => {
    if (!personId) return [];
    const found = personOptions.find((o) => o.id === personId);
    return found ? [{ id: found.id, label: found.label }] : [];
  }, [personId, personOptions]);

  const [pickerValue, setPickerValue] = useState<Date[]>(() => [
    new Date(`${from}T00:00:00.000Z`),
    new Date(`${to}T00:00:00.000Z`),
  ]);

  const applyRange = (next: (Date | null | undefined)[] | null | undefined) => {
    if (!next || !next[0] || !next[1]) return;
    const f = isoDay(next[0]);
    const t = isoDay(next[1]);
    setPickerValue([next[0], next[1]]);
    navigate({ from: f, to: t });
  };

  const total = deposits.reduce((s, d) => s + d.amount, 0);

  const cancelMut = useMutation({
    mutationFn: async (row: UnifiedDeposit) => {
      if (row.source === 'member') return cancelPayment({ id: row.id });
      return cancelGuestDeposit({ id: row.id });
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div>
      <Tabs
        activeKey={TAB_KEY[tab]}
        onChange={({ activeKey }) => navigate({ tab: tabFromKey(String(activeKey)), personId: null })}
        activateOnFocus
      >
        <Tab key="all" title={m.received.tabAll} />
        <Tab key="members" title={m.received.tabMembers} />
        <Tab key="guests" title={m.received.tabGuests} />
      </Tabs>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 16,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '1 1 280px', minWidth: 240 }}>
          <FormControl label={`${m.received.filterFrom} → ${m.received.filterTo}`}>
            <DatePicker
              value={pickerValue}
              onChange={({ date }) => applyRange(Array.isArray(date) ? date : [date])}
              range
              quickSelect
              formatString="yyyy-MM-dd"
            />
          </FormControl>
        </div>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <FormControl label={m.received.filterPerson}>
            <Select
              options={personOptions.map((o) => ({ id: o.id, label: o.label }))}
              value={selectValue}
              placeholder={m.received.filterPersonAll}
              clearable
              onChange={(p) => {
                const id = (p.value[0]?.id as string | undefined) ?? null;
                navigate({ personId: id });
              }}
            />
          </FormControl>
        </div>
      </div>

      <div style={{ color: '#6b7280', fontSize: 13, margin: '8px 0 12px' }}>
        {m.received.rangeTotal(deposits.length, formatCents(total))}
      </div>

      {deposits.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
          {m.received.empty}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {deposits.map((d) => (
            <li
              key={`${d.source}-${d.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <span style={{ minWidth: 100, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                {d.receivedAt.slice(0, 10)}
              </span>
              <span style={{ minWidth: 70 }}>
                <Tag
                  closeable={false}
                  kind={d.source === 'member' ? 'accent' : 'warning'}
                >
                  {d.source === 'member' ? m.received.sourceMember : m.received.sourceGuest}
                </Tag>
              </span>
              <span style={{ flex: '1 1 160px', minWidth: 0 }}>
                {d.personName || m.people.guests.anonymous}
                {d.personArchived ? m.people.guests.archivedSuffix : ''}
              </span>
              <span style={{ minWidth: 60, color: '#374151' }}>
                {d.method === 'cash' ? m.common.cash : m.common.card}
              </span>
              <span
                style={{
                  minWidth: 80,
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCents(d.amount)}
              </span>
              <span style={{ flex: '1 1 200px', minWidth: 0, color: '#6b7280' }}>
                {d.note || m.received.noNote}
              </span>
              {isAdmin && (
                <Button
                  kind={KIND.tertiary}
                  size={SIZE.mini}
                  isLoading={cancelMut.isPending && cancelMut.variables?.id === d.id}
                  onClick={() => {
                    if (confirm(m.received.confirmCancel)) cancelMut.mutate(d);
                  }}
                >
                  {m.common.delete}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {cancelMut.isError && (
        <p style={{ color: '#b91c1c', marginTop: 8 }}>
          {cancelMut.error instanceof Error ? cancelMut.error.message : String(cancelMut.error)}
        </p>
      )}
    </div>
  );
}
