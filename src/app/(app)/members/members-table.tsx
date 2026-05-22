'use client';

import { forwardRef, useMemo, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  StyledTableBodyRow,
  TableBuilder,
  TableBuilderColumn,
} from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted, StatusBadge } from '@/ui/text';

export interface MemberRow {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  debtFormatted: string | null;
  creditFormatted?: string | null;
}

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const m = useMessages();
  const router = useRouter();

  const ClickableRow = useMemo(
    () =>
      forwardRef<
        HTMLTableRowElement,
        { $row: MemberRow } & React.HTMLAttributes<HTMLTableRowElement>
      >(function ClickableRow({ $row, ...rest }, ref) {
        const href = `/members/${$row.id}`;
        const isInteractive = (e: MouseEvent<HTMLTableRowElement>) =>
          (e.target as HTMLElement).closest(INTERACTIVE_SELECTOR) != null;
        const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
          if (isInteractive(e)) return;
          if (e.metaKey || e.ctrlKey) {
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
          }
          router.push(href);
        };
        const onAuxClick = (e: MouseEvent<HTMLTableRowElement>) => {
          if (e.button !== 1 || isInteractive(e)) return;
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        };
        return (
          <StyledTableBodyRow
            ref={ref}
            {...rest}
            onClick={onClick}
            onAuxClick={onAuxClick}
            style={{ cursor: 'pointer' }}
          />
        );
      }),
    [router],
  );

  return (
    <TableBuilder
      data={rows}
      emptyMessage={m.common.none}
      overrides={{ TableBodyRow: { component: ClickableRow } }}
    >
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
      <TableBuilderColumn header={m.wallet.members.column}>
        {(r: MemberRow) =>
          r.creditFormatted ? (
            <StatusBadge tone="positive">{r.creditFormatted}</StatusBadge>
          ) : (
            <Muted>—</Muted>
          )
        }
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
