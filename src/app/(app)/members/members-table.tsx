'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { Muted, StatusBadge } from '@/ui/text';

export interface MemberRow {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  debtFormatted: string | null;
  creditFormatted?: string | null;
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const creditBadge = r.creditFormatted ? (
          <StatusBadge tone="positive">{r.creditFormatted}</StatusBadge>
        ) : null;
        const statusBadge = r.debtFormatted ? (
          <StatusBadge tone="negative">{m.common.owesAmount(r.debtFormatted)}</StatusBadge>
        ) : (
          <StatusBadge tone="positive">{m.common.settled}</StatusBadge>
        );
        return (
          <DataCard
            key={r.id}
            href={`/members/${r.id}`}
            title={
              <>
                {r.displayName}
                {!r.isActive && <Muted>{` ${m.common.inactive}`}</Muted>}
              </>
            }
            subtitle={r.role}
            badges={
              <>
                {creditBadge}
                {statusBadge}
              </>
            }
          />
        );
      })}
    </DataList>
  );
}
