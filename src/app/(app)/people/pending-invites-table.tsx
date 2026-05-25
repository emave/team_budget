'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, KIND, SIZE } from 'baseui/button';
import { revokeInvite } from '@/server/actions/members-server';
import { useLocale, useMessages } from '@/app/_i18n-provider';
import { formatDate } from '@/shared/i18n';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
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
    <DataList emptyMessage={m.people.noPendingInvites} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.displayNameHint ? r.displayNameHint : <Muted>{m.people.hintEmpty}</Muted>}
          subtitle={formatDate(r.createdAt, locale)}
          actions={<RowActions row={r} />}
        />
      ))}
    </DataList>
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
      // clipboard may be blocked; ignore
    }
  }

  function onRevoke() {
    if (!window.confirm(m.people.confirmRevoke)) return;
    revoke.mutate();
  }

  return (
    <>
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={onCopy}>
        {copied ? m.people.copied : m.people.copyLink}
      </Button>
      <Button
        kind={KIND.secondary}
        size={SIZE.compact}
        onClick={onRevoke}
        isLoading={revoke.isPending}
      >
        {m.people.revoke}
      </Button>
    </>
  );
}
