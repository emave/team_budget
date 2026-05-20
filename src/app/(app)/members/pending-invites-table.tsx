'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, KIND, SIZE } from 'baseui/button';
import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { revokeInvite } from '@/server/actions/members-server';
import { useLocale, useMessages } from '@/app/_i18n-provider';
import { formatDate } from '@/shared/i18n';
import { Muted } from '@/ui/text';

export interface PendingInviteRow {
  id: string;
  token: string;
  displayNameHint: string | null;
  createdAt: string;
}

function buildInviteLink(token: string): string {
  const botUsername = (window as { __BOT_USERNAME__?: string }).__BOT_USERNAME__ ?? '';
  return botUsername ? `https://t.me/${botUsername}?start=invite_${token}` : `invite_${token}`;
}

export function PendingInvitesTable({ rows }: { rows: PendingInviteRow[] }) {
  const m = useMessages();
  const locale = useLocale();
  return (
    <TableBuilder data={rows} emptyMessage={m.members.noPendingInvites}>
      <TableBuilderColumn header={m.members.colHint}>
        {(r: PendingInviteRow) =>
          r.displayNameHint ? r.displayNameHint : <Muted>{m.members.hintEmpty}</Muted>
        }
      </TableBuilderColumn>
      <TableBuilderColumn header={m.members.colCreated}>
        {(r: PendingInviteRow) => <Muted>{formatDate(r.createdAt, locale)}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.members.colActions}>
        {(r: PendingInviteRow) => <RowActions row={r} />}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

function RowActions({ row }: { row: PendingInviteRow }) {
  const m = useMessages();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const revoke = useMutation({
    mutationFn: () => revokeInvite({ id: row.id }),
    onSuccess: () => router.refresh(),
  });

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(buildInviteLink(row.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; ignore — user can still read the link from the modal
    }
  }

  function onRevoke() {
    if (!window.confirm(m.members.confirmRevoke)) return;
    revoke.mutate();
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={onCopy}>
        {copied ? m.members.copied : m.members.copyLink}
      </Button>
      <Button
        kind={KIND.secondary}
        size={SIZE.compact}
        onClick={onRevoke}
        isLoading={revoke.isPending}
      >
        {m.members.revoke}
      </Button>
    </div>
  );
}
