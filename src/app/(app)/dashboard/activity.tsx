'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { HeadingSmall } from 'baseui/typography';
import { useMessages } from '@/app/_i18n-provider';
import { Panel } from '@/ui/panel';
import { Muted } from '@/ui/text';

export interface ActivityRow {
  key: string;
  event: string;
  whenFormatted: string;
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  const m = useMessages();
  return (
    <div style={{ marginTop: 16 }}>
      <Panel>
        <HeadingSmall marginTop="0" marginBottom="scale400">{m.dashboard.activityHeading}</HeadingSmall>
        <TableBuilder data={rows} emptyMessage={m.dashboard.noActivity}>
          <TableBuilderColumn header={m.dashboard.colEvent}>
            {(r: ActivityRow) => r.event}
          </TableBuilderColumn>
          <TableBuilderColumn header={m.dashboard.colWhen}>
            {(r: ActivityRow) => <Muted>{r.whenFormatted}</Muted>}
          </TableBuilderColumn>
        </TableBuilder>
      </Panel>
    </div>
  );
}
