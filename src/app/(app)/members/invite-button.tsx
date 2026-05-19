'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useForm } from 'react-hook-form';
import { inviteMember } from '@/server/actions/members-server';
import { useMutation } from '@tanstack/react-query';

interface FormValues {
  displayNameHint: string;
}

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { displayNameHint: '' } });

  const m = useMutation({
    mutationFn: async (v: FormValues) => inviteMember(v),
    onSuccess: (inv) => {
      const botUsername = (window as { __BOT_USERNAME__?: string }).__BOT_USERNAME__ ?? '';
      setLink(botUsername ? `https://t.me/${botUsername}?start=invite_${inv.token}` : `invite_${inv.token}`);
    },
  });

  return (
    <>
      <Button onClick={() => { setOpen(true); setLink(null); reset(); }}>+ Invite</Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>Invite a member</ModalHeader>
        <ModalBody>
          {!link && (
            <form onSubmit={handleSubmit((v: FormValues) => m.mutate(v))}>
              <FormControl label="Display name (optional)">
                <Input {...(register('displayNameHint') as object)} placeholder="Vasya" />
              </FormControl>
              <Button type="submit" isLoading={m.isPending}>Generate link</Button>
            </form>
          )}
          {link && (
            <div>
              <p>Share this link in Telegram:</p>
              <code style={{ display: 'block', padding: 12, background: '#f3f4f6', borderRadius: 4, wordBreak: 'break-all' }}>{link}</code>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={() => setOpen(false)}>Close</ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
