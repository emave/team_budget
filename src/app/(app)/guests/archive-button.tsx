'use client';

import { Button, KIND, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { archiveGuest, unarchiveGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const m = useMessages();
  const router = useRouter();
  const mutate = useMutation({
    mutationFn: () => (archived ? unarchiveGuest({ id }) : archiveGuest({ id })),
    onSuccess: () => router.refresh(),
  });
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      onClick={() => {
        if (!archived && !window.confirm(m.guests.confirmArchive)) return;
        mutate.mutate();
      }}
      isLoading={mutate.isPending}
    >
      {archived ? m.guests.btnUnarchive : m.guests.btnArchive}
    </Button>
  );
}
