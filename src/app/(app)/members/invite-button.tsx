'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useForm } from 'react-hook-form';
import { inviteMember } from '@/server/actions/members-server';
import { useMutation } from '@tanstack/react-query';
import { useMessages } from '@/app/_i18n-provider';

interface FormValues {
  displayNameHint: string;
}

export function InviteButton() {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { displayNameHint: '' } });

  const mut = useMutation({
    mutationFn: async (v: FormValues) => inviteMember(v),
    onSuccess: (inv) => {
      const botUsername = (window as { __BOT_USERNAME__?: string }).__BOT_USERNAME__ ?? '';
      setLink(botUsername ? `https://t.me/${botUsername}?start=invite_${inv.token}` : `invite_${inv.token}`);
    },
  });

  return (
    <>
      <Button onClick={() => { setOpen(true); setLink(null); reset(); }}>{m.members.invite}</Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>{m.members.inviteModalTitle}</ModalHeader>
        <ModalBody>
          {!link && (
            <form onSubmit={handleSubmit((v: FormValues) => mut.mutate(v))}>
              <FormControl label={m.members.displayNameLabel}>
                <Input {...(register('displayNameHint') as object)} placeholder={m.members.displayNamePlaceholder} />
              </FormControl>
              <Button type="submit" isLoading={mut.isPending}>{m.members.generateLink}</Button>
              {mut.isError && (
                <p style={{ color: '#b91c1c', marginTop: 12 }}>
                  {mut.error instanceof Error ? mut.error.message : String(mut.error)}
                </p>
              )}
            </form>
          )}
          {link && (
            <div>
              <p>{m.members.shareLink}</p>
              <code style={{ display: 'block', padding: 12, background: '#f3f4f6', borderRadius: 4, wordBreak: 'break-all' }}>{link}</code>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={() => setOpen(false)}>{m.members.closeButton}</ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
