'use client';

import { useState } from 'react';
import { Button, KIND } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { RadioGroup, Radio } from 'baseui/radio';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  deactivateMember,
  reactivateMember,
  editMember,
  deleteMember,
} from '@/server/actions/members-server';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import type { DeleteBlockReason } from '@/server/domain/users';

interface Props {
  user: { id: string; displayName: string; isActive: boolean; role: 'admin' | 'member' };
  isSelf: boolean;
  deleteBlockedReason: DeleteBlockReason | null;
}

interface EditForm {
  displayName: string;
  role: 'admin' | 'member';
}

export function AdminControls({ user, isSelf, deleteBlockedReason }: Props) {
  const m = useMessages();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm<EditForm>({
    defaultValues: { displayName: user.displayName, role: user.role },
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateMember({ id: user.id }),
    onSuccess: () => router.refresh(),
  });
  const reactivate = useMutation({
    mutationFn: () => reactivateMember({ id: user.id }),
    onSuccess: () => router.refresh(),
  });
  const edit = useMutation({
    mutationFn: (v: EditForm) =>
      editMember({ id: user.id, displayName: v.displayName, role: v.role }),
    onSuccess: () => {
      setEditOpen(false);
      router.refresh();
    },
  });
  const del = useMutation({
    mutationFn: () => deleteMember({ id: user.id }),
    onSuccess: () => router.push('/members'),
  });

  const blockedText =
    deleteBlockedReason === 'has_financial_history'
      ? m.members.deleteBlockedHasHistory
      : deleteBlockedReason === 'has_invites'
        ? m.members.deleteBlockedHasInvites
        : null;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        kind={KIND.secondary}
        onClick={() => {
          reset({ displayName: user.displayName, role: user.role });
          setEditOpen(true);
        }}
      >
        {m.common.edit}
      </Button>

      {user.isActive ? (
        <Button
          kind={KIND.secondary}
          onClick={() => deactivate.mutate()}
          isLoading={deactivate.isPending}
        >
          {m.members.deactivate}
        </Button>
      ) : (
        <Button
          kind={KIND.secondary}
          onClick={() => reactivate.mutate()}
          isLoading={reactivate.isPending}
        >
          {m.members.reactivate}
        </Button>
      )}

      {!isSelf && (
        <>
          <Button
            kind={KIND.secondary}
            disabled={blockedText !== null}
            onClick={() => setConfirmDeleteOpen(true)}
            isLoading={del.isPending}
          >
            {m.members.deleteButton}
          </Button>
          {blockedText && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>{blockedText}</span>
          )}
        </>
      )}

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)}>
        <ModalHeader>{m.members.editModalTitle}</ModalHeader>
        <ModalBody>
          <form
            id="edit-member-form"
            onSubmit={handleSubmit((v) => edit.mutate(v))}
          >
            <FormControl label={m.members.editDisplayNameLabel}>
              <Controller
                control={control}
                name="displayName"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
            </FormControl>
            <FormControl label={m.members.roleLabel}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  >
                    <Radio value="admin">{m.members.roleAdmin}</Radio>
                    <Radio value="member">{m.members.roleMember}</Radio>
                  </RadioGroup>
                )}
              />
            </FormControl>
            {edit.isError && (
              <p style={{ color: '#b91c1c', marginTop: 12 }}>
                {edit.error instanceof Error ? edit.error.message : String(edit.error)}
              </p>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setEditOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            type="submit"
            form="edit-member-form"
            isLoading={edit.isPending}
          >
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <ModalHeader>{m.members.deleteButton}</ModalHeader>
        <ModalBody>{m.members.confirmDelete(user.displayName)}</ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setConfirmDeleteOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => {
              setConfirmDeleteOpen(false);
              del.mutate();
            }}
            isLoading={del.isPending}
          >
            {m.members.deleteButton}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
