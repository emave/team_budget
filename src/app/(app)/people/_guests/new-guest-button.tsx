'use client';

import { useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Input } from 'baseui/input';
import { FormControl } from 'baseui/form-control';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';
import { ActionNewIcon } from '@/ui/icons';

export function NewGuestButton() {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => createGuest({ name }),
    onSuccess: () => { setOpen(false); setName(''); router.refresh(); },
  });
  return (
    <>
      <Button kind={KIND.primary} size={SIZE.compact} startEnhancer={<ActionNewIcon />} onClick={() => setOpen(true)}>
        {m.people.guests.addNew}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>{m.people.guests.nameModalTitle}</ModalHeader>
        <ModalBody>
          <FormControl label={m.people.guests.namePromptLabel}>
            <Input value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {m.common.create}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
