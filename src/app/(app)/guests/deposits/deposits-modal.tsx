'use client';

import { useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Button, KIND } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';
import { cancelGuestDeposit } from '@/server/actions/guest-deposits-server';

export interface DepositRow {
  id: string;
  guestId: string | null;
  date: string;
  receivedAt: string;
  amount: number;
  method: 'cash' | 'card';
  note: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  guestLabel: string;
  date: string;
  rows: DepositRow[];
}

export function DepositsModal({ isOpen, onClose, guestLabel, date, rows }: Props) {
  const m = useMessages();
  const router = useRouter();

  const cancelMut = useMutation({
    mutationFn: async (id: string) => cancelGuestDeposit({ id }),
    onSuccess: () => router.refresh(),
  });

  useEffect(() => {
    if (isOpen && rows.length === 0) onClose();
  }, [isOpen, rows.length, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>{m.guests.depositsModalTitle(guestLabel, date)}</ModalHeader>
      <ModalBody>
        {rows.length === 0 ? (
          <div style={{ color: '#6b7280' }}>{m.guests.depositsModalEmpty}</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {rows.map((r) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <span style={{ flex: 1 }}>
                  <strong>{formatCents(r.amount)}</strong>
                  {' · '}
                  {r.method === 'cash' ? m.common.cash : m.common.card}
                  {' · '}
                  <span style={{ color: '#6b7280' }}>{r.note || m.guests.depositNoNote}</span>
                </span>
                <Button
                  kind={KIND.tertiary}
                  size="mini"
                  onClick={() => cancelMut.mutate(r.id)}
                  isLoading={cancelMut.isPending}
                >
                  {m.common.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {cancelMut.isError && (
          <p style={{ color: '#b91c1c', marginTop: 8 }}>
            {cancelMut.error instanceof Error
              ? cancelMut.error.message
              : String(cancelMut.error)}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <ModalButton kind="tertiary" onClick={onClose}>
          {m.common.close}
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
}
