'use client';

import Link from 'next/link';
import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted, StatusBadge } from '@/ui/text';

export interface MemberRow {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  debtFormatted: string | null;
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.common.none}>
      <TableBuilderColumn header={m.members.colMember}>
        {(r: MemberRow) => (
          <Link href={`/members/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {r.displayName}
            {!r.isActive && <Muted>{` ${m.common.inactive}`}</Muted>}
          </Link>
        )}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.members.colRole}>
        {(r: MemberRow) => <Muted>{r.role}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.members.colStatus}>
        {(r: MemberRow) =>
          r.debtFormatted ? (
            <StatusBadge tone="negative">{m.common.owesAmount(r.debtFormatted)}</StatusBadge>
          ) : (
            <StatusBadge tone="positive">{m.common.settled}</StatusBadge>
          )
        }
      </TableBuilderColumn>
    </TableBuilder>
  );
}
