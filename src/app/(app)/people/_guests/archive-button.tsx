'use client';

import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { archiveGuest, unarchiveGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';
import { RowArchiveIcon, RowUnarchiveIcon } from '@/ui/icons';

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const m = useMessages();
  const router = useRouter();
  const mutate = useMutation({
    mutationFn: () => (archived ? unarchiveGuest({ id }) : archiveGuest({ id })),
    onSuccess: () => router.refresh(),
  });
  const label = archived ? m.people.guests.btnUnarchive : m.people.guests.btnArchive;
  const Icon = archived ? RowUnarchiveIcon : RowArchiveIcon;
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      shape={SHAPE.square}
      onClick={() => {
        if (!archived && !window.confirm(m.people.guests.confirmArchive)) return;
        mutate.mutate();
      }}
      isLoading={mutate.isPending}
      title={label}
      aria-label={label}
    >
      <Icon size={14} />
    </Button>
  );
}
