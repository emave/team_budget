'use client';

import { useState } from 'react';
import { Button, KIND } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { RadioGroup, Radio } from 'baseui/radio';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useStyletron } from 'baseui';
import {
  deactivateMember,
  reactivateMember,
  editMember,
  deleteMember,
} from '@/server/actions/members-server';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import type { DeleteBlockReason } from '@/server/domain/users';
import { SMALL } from '@/ui/breakpoints';

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
  const [css] = useStyletron();
  const btnContainer = css({
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    [SMALL]: { width: '100%' },
  });
  const fullOnSmall = {
    BaseButton: {
      style: {
        [SMALL]: { flex: '1 1 0', width: '100%' },
      } as Record<string, unknown>,
    },
  };

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [creditConfirm, setCreditConfirm] = useState<{ balance: number } | null>(null);

  const { control, handleSubmit, reset } = useForm<EditForm>({
    defaultValues: { displayName: user.displayName, role: user.role },
  });

  const deactivate = useMutation({
    mutationFn: (force?: boolean) => deactivateMember({ id: user.id, force }),
    onSuccess: (res) => {
      if (res && 'requiresConfirmation' in res && res.requiresConfirmation) {
        setCreditConfirm({ balance: res.creditBalance });
        return;
      }
      router.refresh();
    },
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
    onSuccess: () => router.push('/people'),
  });

  const blockedText =
    deleteBlockedReason === 'has_financial_history'
      ? m.people.deleteBlockedHasHistory
      : deleteBlockedReason === 'has_invites'
        ? m.people.deleteBlockedHasInvites
        : null;

  return (
    <div className={btnContainer}>
      <Button
        kind={KIND.secondary}
        onClick={() => {
          reset({ displayName: user.displayName, role: user.role });
          setEditOpen(true);
        }}
        overrides={fullOnSmall}
      >
        {m.common.edit}
      </Button>

      {user.isActive ? (
        <Button
          kind={KIND.secondary}
          onClick={() => deactivate.mutate(undefined)}
          isLoading={deactivate.isPending}
          overrides={fullOnSmall}
        >
          {m.people.deactivate}
        </Button>
      ) : (
        <Button
          kind={KIND.secondary}
          onClick={() => reactivate.mutate()}
          isLoading={reactivate.isPending}
          overrides={fullOnSmall}
        >
          {m.people.reactivate}
        </Button>
      )}

      {!isSelf && (
        <>
          <Button
            kind={KIND.secondary}
            disabled={blockedText !== null}
            onClick={() => setConfirmDeleteOpen(true)}
            isLoading={del.isPending}
            overrides={fullOnSmall}
          >
            {m.people.deleteButton}
          </Button>
          {blockedText && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>{blockedText}</span>
          )}
        </>
      )}

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)}>
        <ModalHeader>{m.people.editModalTitle}</ModalHeader>
        <ModalBody>
          <form
            id="edit-member-form"
            onSubmit={handleSubmit((v) => edit.mutate(v))}
          >
            <FormControl label={m.people.editDisplayNameLabel}>
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
            <FormControl label={m.people.roleLabel}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  >
                    <Radio value="admin">{m.people.roleAdmin}</Radio>
                    <Radio value="member">{m.people.roleMember}</Radio>
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

      <Modal isOpen={creditConfirm !== null} onClose={() => setCreditConfirm(null)}>
        <ModalHeader>{m.wallet.deactivateConfirmTitle}</ModalHeader>
        <ModalBody>
          {creditConfirm
            ? m.wallet.deactivateConfirmBody(user.displayName, creditConfirm.balance)
            : null}
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setCreditConfirm(null)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => {
              setCreditConfirm(null);
              deactivate.mutate(true);
            }}
            isLoading={deactivate.isPending}
          >
            {m.people.deactivate}
          </ModalButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <ModalHeader>{m.people.deleteButton}</ModalHeader>
        <ModalBody>{m.people.confirmDelete(user.displayName)}</ModalBody>
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
            {m.people.deleteButton}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
