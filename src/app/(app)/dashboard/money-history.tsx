'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeadingSmall } from 'baseui/typography';
import { DatePicker } from 'baseui/datepicker';
import { Input } from 'baseui/input';
import { StatefulTooltip } from 'baseui/tooltip';
import { Tag } from 'baseui/tag';
import { useMessages } from '@/app/_i18n-provider';
import { Panel } from '@/ui/panel';
import { Muted } from '@/ui/text';
import { formatCents } from '@/shared/format';
import { eachDayBetween, isoDay, MAX_RANGE_DAYS } from '@/shared/date-range';
import type { Movement } from '@/server/domain/movements';

interface Props {
  movements: Movement[];
  range: { from: string; to: string };
  clamped: boolean;
}

type LaneKey = `member:${string}` | 'pot:cash' | 'pot:card';

interface Lane {
  key: LaneKey;
  label: string;
  kind: 'member' | 'pot';
}

export function MoneyHistory({ movements, range, clamped }: Props) {
  const m = useMessages();
  const router = useRouter();

  const days = useMemo(() => eachDayBetween(range.from, range.to), [range.from, range.to]);

  const memberLanes = useMemo<Lane[]>(() => {
    const totals = new Map<string, { name: string; total: number }>();
    for (const ev of movements) {
      if (ev.kind !== 'deposit') continue;
      const cur = totals.get(ev.payerUserId);
      if (cur) cur.total += ev.amount;
      else totals.set(ev.payerUserId, { name: ev.payerDisplayName, total: ev.amount });
    }
    return [...totals.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]): Lane => ({ key: `member:${id}`, label: v.name, kind: 'member' }));
  }, [movements]);

  const potLanes: Lane[] = [
    { key: 'pot:cash', label: m.dashboard.laneCashPot, kind: 'pot' },
    { key: 'pot:card', label: m.dashboard.laneCardPot, kind: 'pot' },
  ];

  const lanes = [...memberLanes, ...potLanes];

  const cells = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const ev of movements) {
      const day = ev.at.slice(0, 10);
      const laneKey: LaneKey =
        ev.kind === 'deposit'
          ? `member:${ev.payerUserId}`
          : ev.kind === 'guest_deposit'
          ? `pot:${ev.method}`
          : ev.kind === 'credit_refund'
          ? `pot:${ev.method}`
          : `pot:${ev.pot}`;
      const k = `${laneKey}|${day}`;
      const arr = map.get(k);
      if (arr) arr.push(ev);
      else map.set(k, [ev]);
    }
    return map;
  }, [movements]);

  const initial: Date[] = [
    new Date(`${range.from}T00:00:00.000Z`),
    new Date(`${range.to}T00:00:00.000Z`),
  ];
  const [pickerValue, setPickerValue] = useState<Date[]>(initial);

  function applyRange(next: (Date | null | undefined)[] | null | undefined) {
    if (!next || !next[0] || !next[1]) return;
    const from = isoDay(next[0]);
    const to = isoDay(next[1]);
    setPickerValue([next[0], next[1]]);
    router.push(`/dashboard?from=${from}&to=${to}`);
  }

  const todayIso = isoDay(new Date());

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayHeaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const todayEl = todayHeaderRef.current;
    if (!scroller || !todayEl) return;
    if (todayIso < range.from || todayIso > range.to) return;
    const target = todayEl.offsetLeft - scroller.clientWidth / 2 + todayEl.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, target);
  }, [range.from, range.to, todayIso]);

  return (
    <div style={{ marginTop: 16 }}>
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap', rowGap: 8 }}>
          <HeadingSmall marginTop="0" marginBottom="0">{m.dashboard.movementsHeading}</HeadingSmall>
          <div style={{ flex: '1 1 240px' }}>
            <DatePicker
              value={pickerValue}
              onChange={({ date }) => applyRange(Array.isArray(date) ? date : [date])}
              range
              quickSelect
              formatString="yyyy-MM-dd"
              overrides={{ Input: { component: Input } }}
            />
          </div>
        </div>

        {clamped && (
          <Muted>{m.dashboard.rangeClamped(MAX_RANGE_DAYS)}</Muted>
        )}

        {movements.length === 0 && memberLanes.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Muted>{m.dashboard.noMovements}</Muted>
          </div>
        ) : (
          <div ref={scrollRef} style={{ overflowX: 'auto', marginTop: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(120px, max-content) repeat(${days.length}, minmax(64px, 1fr))`,
                rowGap: 1,
                columnGap: 1,
                background: '#e5e7eb',
                minWidth: 'fit-content',
              }}
            >
              <div style={cellHeaderStickyBoth} />
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00.000Z`);
                const dow = dt.getUTCDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = d === todayIso;
                return (
                  <div
                    key={d}
                    ref={isToday ? todayHeaderRef : undefined}
                    style={{
                      ...cellHeaderTop,
                      color: isWeekend ? '#9ca3af' : '#374151',
                      background: isToday ? '#fef3c7' : '#f9fafb',
                    }}
                  >
                    {d.slice(5)}
                  </div>
                );
              })}

              {lanes.map((lane, idx) => {
                const isFirstPotRow = lane.kind === 'pot' && idx > 0 && lanes[idx - 1]?.kind === 'member';
                return (
                  <LaneRow
                    key={lane.key}
                    lane={lane}
                    days={days}
                    cells={cells}
                    drawDivider={isFirstPotRow}
                    todayIso={todayIso}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function LaneRow({
  lane, days, cells, drawDivider, todayIso,
}: {
  lane: Lane;
  days: string[];
  cells: Map<string, Movement[]>;
  drawDivider: boolean;
  todayIso: string;
}) {
  return (
    <>
      <div
        style={{
          ...cellLaneLabel,
          fontWeight: lane.kind === 'pot' ? 600 : 500,
          color: lane.kind === 'pot' ? '#7c2d12' : '#111827',
          borderTop: drawDivider ? '2px solid #d1d5db' : 'none',
        }}
      >
        {lane.kind === 'pot' ? <PotBadge label={lane.label} /> : lane.label}
      </div>
      {days.map((d) => {
        const evs = cells.get(`${lane.key}|${d}`) ?? [];
        const dt = new Date(`${d}T00:00:00.000Z`);
        const dow = dt.getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        const isToday = d === todayIso;
        return (
          <div
            key={d}
            style={{
              ...cellBody,
              background: isToday ? '#fffbeb' : isWeekend ? '#fafafa' : '#ffffff',
              borderTop: drawDivider ? '2px solid #d1d5db' : 'none',
            }}
          >
            {evs.map((ev) => <EventCard key={`${ev.kind}-${ev.id}`} ev={ev} />)}
          </div>
        );
      })}
    </>
  );
}

function EventCard({ ev }: { ev: Movement }) {
  const tooltip =
    ev.kind === 'deposit'
      ? (ev.note ?? '')
      : ev.kind === 'guest_deposit'
      ? (ev.note ?? '')
      : ev.kind === 'credit_refund'
      ? `Refund → ${ev.userDisplayName}${ev.note ? `: ${ev.note}` : ''}`
      : ev.description;
  const isOutflow = ev.kind === 'withdraw' || ev.kind === 'credit_refund';
  const sign = isOutflow ? '−' : '+';
  const color = isOutflow ? '#991b1b' : '#065f46';
  const bg = isOutflow ? '#fee2e2' : '#d1fae5';
  return (
    <StatefulTooltip content={tooltip || null} showArrow>
      <div
        style={{
          fontSize: 12,
          padding: '2px 6px',
          borderRadius: 4,
          background: bg,
          color,
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        {sign}{formatCents(ev.amount).replace(/^-/, '')}
      </div>
    </StatefulTooltip>
  );
}

function PotBadge({ label }: { label: string }) {
  return <Tag closeable={false} kind="warning">{label}</Tag>;
}

const cellHeaderStickyBoth: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  top: 0,
  background: '#f3f4f6',
  zIndex: 3,
  padding: '6px 10px',
};

const cellHeaderTop: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: '6px 8px',
  fontSize: 12,
  textAlign: 'center',
};

const cellLaneLabel: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: '#f9fafb',
  zIndex: 1,
  padding: '6px 10px',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
};

const cellBody: React.CSSProperties = {
  padding: 4,
  minHeight: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
