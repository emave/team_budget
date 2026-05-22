'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted } from '@/ui/text';
import { RenameButton } from './rename-button';
import { ArchiveButton } from './archive-button';

export interface GuestRow {
  id: string;
  name: string;
  archived: boolean;
  totalFormatted: string;
  count: number;
  lastFormatted: string;
}

export function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.guests.none}>
      <TableBuilderColumn header={m.guests.colName}>
        {(r: GuestRow) => (
          <span>
            {r.name}
            {r.archived && <Muted>{m.guests.archivedSuffix}</Muted>}
          </span>
        )}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colTotal} numeric>
        {(r: GuestRow) => r.totalFormatted}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colCount} numeric>
        {(r: GuestRow) => r.count}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colLast}>
        {(r: GuestRow) => <Muted>{r.lastFormatted}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colActions}>
        {(r: GuestRow) => (
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <RenameButton id={r.id} name={r.name} />
            <ArchiveButton id={r.id} archived={r.archived} />
          </span>
        )}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
