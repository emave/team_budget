'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
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
    <DataList emptyMessage={m.guests.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={
            <>
              {r.name}
              {r.archived && <Muted>{m.guests.archivedSuffix}</Muted>}
            </>
          }
          titleRight={r.totalFormatted}
          subtitle={`${r.count} · ${r.lastFormatted}`}
          actions={
            <>
              <RenameButton id={r.id} name={r.name} />
              <ArchiveButton id={r.id} archived={r.archived} />
            </>
          }
        />
      ))}
    </DataList>
  );
}
