'use client';

import { useState } from 'react';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { renameGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';
import { RowRenameIcon } from '@/ui/icons';

export function RenameButton({ id, name }: { id: string; name: string }) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const mutate = useMutation({
    mutationFn: () => renameGuest({ id, name: value }),
    onSuccess: () => { setOpen(false); router.refresh(); },
  });
  return (
    <>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.square}
        onClick={() => { setValue(name); setOpen(true); }}
        title={m.guests.btnRename}
        aria-label={m.guests.btnRename}
      >
        <RowRenameIcon size={14} />
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>{m.guests.renameModalTitle}</ModalHeader>
        <ModalBody>
          <Input value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setOpen(false)}>{m.common.cancel}</ModalButton>
          <ModalButton onClick={() => mutate.mutate()} disabled={!value.trim() || mutate.isPending}>
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
