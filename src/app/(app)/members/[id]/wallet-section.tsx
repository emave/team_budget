'use client';

import { useState } from 'react';
import { Button, KIND } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { RadioGroup, Radio } from 'baseui/radio';
import { Select, type Option } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';
import {
  recordCreditDeposit,
  refundCredit,
  transferCredit,
  cancelCreditMovement,
} from '@/server/actions/credit-server';
import { cancelPayment } from '@/server/actions/payments-server';

export interface WalletHistoryItem {
  kind:
    | 'payment_deposit'
    | 'payment_consumption'
    | 'refund'
    | 'transfer_in'
    | 'transfer_out';
  id: string;
  occurredAt: string;
  amount: number;
  description: string;
  cancellable: boolean;
  sourceKind: 'payment' | 'movement' | null;
}

export interface WalletTransferOption {
  id: string;
  displayName: string;
}

interface Props {
  isAdmin: boolean;
  userId: string;
  userDisplayName: string;
  balance: number;
  history: WalletHistoryItem[];
  transferOptions: WalletTransferOption[];
}

interface DepositForm {
  amount: string;
  method: 'cash' | 'card';
  note: string;
}
interface RefundForm {
  amount: string;
  method: 'cash' | 'card';
  note: string;
}
interface TransferForm {
  toUserId: string;
  amount: string;
  note: string;
}

function parseMoneyToCents(v: string): number {
  const trimmed = v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Invalid amount');
  }
  const [w, f = ''] = trimmed.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}

export function WalletSection({
  isAdmin,
  userId,
  userDisplayName,
  balance,
  history,
  transferOptions,
}: Props) {
  const m = useMessages();
  const router = useRouter();

  const [depositOpen, setDepositOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deposit, setDeposit] = useState<DepositForm>({ amount: '', method: 'cash', note: '' });
  const [refund, setRefund] = useState<RefundForm>({ amount: '', method: 'cash', note: '' });
  const [transfer, setTransfer] = useState<TransferForm>({ toUserId: '', amount: '', note: '' });
  const [transferDest, setTransferDest] = useState<Option[]>([]);

  const depositMut = useMutation({
    mutationFn: async () =>
      recordCreditDeposit({
        payerUserId: userId,
        method: deposit.method,
        amount: parseMoneyToCents(deposit.amount),
        note: deposit.note || undefined,
      }),
    onSuccess: () => {
      setDepositOpen(false);
      setDeposit({ amount: '', method: 'cash', note: '' });
      router.refresh();
    },
  });

  const refundMut = useMutation({
    mutationFn: async () =>
      refundCredit({
        userId,
        method: refund.method,
        amount: parseMoneyToCents(refund.amount),
        note: refund.note || undefined,
      }),
    onSuccess: () => {
      setRefundOpen(false);
      setRefund({ amount: '', method: 'cash', note: '' });
      router.refresh();
    },
  });

  const transferMut = useMutation({
    mutationFn: async () =>
      transferCredit({
        fromUserId: userId,
        toUserId: transfer.toUserId,
        amount: parseMoneyToCents(transfer.amount),
        note: transfer.note || undefined,
      }),
    onSuccess: () => {
      setTransferOpen(false);
      setTransfer({ toUserId: '', amount: '', note: '' });
      setTransferDest([]);
      router.refresh();
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (item: WalletHistoryItem) => {
      if (item.sourceKind === 'movement') {
        await cancelCreditMovement({ id: item.id });
      } else if (item.sourceKind === 'payment') {
        await cancelPayment({ id: item.id });
      }
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 600 }}>{formatCents(balance)}</div>
        <div style={{ color: '#6b7280', fontSize: 14 }}>{m.wallet.balance}</div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <Button kind={KIND.secondary} onClick={() => setDepositOpen(true)}>
            {m.wallet.depositCta}
          </Button>
          {balance > 0 && (
            <>
              <Button kind={KIND.secondary} onClick={() => setRefundOpen(true)}>
                {m.wallet.refundCta}
              </Button>
              {transferOptions.length > 0 && (
                <Button kind={KIND.secondary} onClick={() => setTransferOpen(true)}>
                  {m.wallet.transferCta}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.wallet.section.historyHeading}</div>
        {history.length === 0 ? (
          <div style={{ color: '#6b7280' }}>{m.wallet.section.noHistory}</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.map((h) => (
              <li
                key={h.id + h.kind}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <span style={{ flex: 1 }}>{h.description}</span>
                {isAdmin && h.cancellable && (
                  <Button
                    kind={KIND.tertiary}
                    size="mini"
                    onClick={() => cancelMut.mutate(h)}
                    isLoading={cancelMut.isPending}
                  >
                    {m.wallet.cancelCta}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={depositOpen} onClose={() => setDepositOpen(false)}>
        <ModalHeader>{m.wallet.depositModal.title}</ModalHeader>
        <ModalBody>
          <FormControl label={m.wallet.depositModal.amountLabel}>
            <Input
              value={deposit.amount}
              onChange={(e) => setDeposit({ ...deposit, amount: e.currentTarget.value })}
            />
          </FormControl>
          <FormControl label={m.wallet.depositModal.methodLabel}>
            <RadioGroup
              value={deposit.method}
              onChange={(e) =>
                setDeposit({ ...deposit, method: e.currentTarget.value as 'cash' | 'card' })
              }
            >
              <Radio value="cash">{m.common.cash}</Radio>
              <Radio value="card">{m.common.card}</Radio>
            </RadioGroup>
          </FormControl>
          <FormControl label={m.wallet.depositModal.noteLabel}>
            <Input
              value={deposit.note}
              onChange={(e) => setDeposit({ ...deposit, note: e.currentTarget.value })}
            />
          </FormControl>
          {depositMut.isError && (
            <p style={{ color: '#b91c1c' }}>
              {depositMut.error instanceof Error
                ? depositMut.error.message
                : String(depositMut.error)}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setDepositOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => depositMut.mutate()}
            isLoading={depositMut.isPending}
            disabled={!deposit.amount}
          >
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={refundOpen} onClose={() => setRefundOpen(false)}>
        <ModalHeader>{m.wallet.refundModal.title}</ModalHeader>
        <ModalBody>
          <FormControl label={m.wallet.refundModal.amountLabel}>
            <Input
              value={refund.amount}
              onChange={(e) => setRefund({ ...refund, amount: e.currentTarget.value })}
            />
          </FormControl>
          <FormControl label={m.wallet.refundModal.methodLabel}>
            <RadioGroup
              value={refund.method}
              onChange={(e) =>
                setRefund({ ...refund, method: e.currentTarget.value as 'cash' | 'card' })
              }
            >
              <Radio value="cash">{m.common.cash}</Radio>
              <Radio value="card">{m.common.card}</Radio>
            </RadioGroup>
          </FormControl>
          <FormControl label={m.wallet.refundModal.noteLabel}>
            <Input
              value={refund.note}
              onChange={(e) => setRefund({ ...refund, note: e.currentTarget.value })}
            />
          </FormControl>
          {refundMut.isError && (
            <p style={{ color: '#b91c1c' }}>
              {refundMut.error instanceof Error
                ? refundMut.error.message
                : String(refundMut.error)}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setRefundOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => refundMut.mutate()}
            isLoading={refundMut.isPending}
            disabled={!refund.amount}
          >
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>

      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)}>
        <ModalHeader>{m.wallet.transferModal.title}</ModalHeader>
        <ModalBody>
          <FormControl label={m.wallet.transferModal.destLabel}>
            <Select
              options={transferOptions.map((o) => ({ id: o.id, label: o.displayName }))}
              value={transferDest}
              onChange={(p) => {
                setTransferDest(p.value as Option[]);
                setTransfer({
                  ...transfer,
                  toUserId: ((p.value[0]?.id as string) ?? '') as string,
                });
              }}
            />
          </FormControl>
          <FormControl label={m.wallet.transferModal.amountLabel}>
            <Input
              value={transfer.amount}
              onChange={(e) => setTransfer({ ...transfer, amount: e.currentTarget.value })}
            />
          </FormControl>
          <FormControl label={m.wallet.transferModal.noteLabel}>
            <Input
              value={transfer.note}
              onChange={(e) => setTransfer({ ...transfer, note: e.currentTarget.value })}
            />
          </FormControl>
          {transferMut.isError && (
            <p style={{ color: '#b91c1c' }}>
              {transferMut.error instanceof Error
                ? transferMut.error.message
                : String(transferMut.error)}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setTransferOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton
            onClick={() => transferMut.mutate()}
            isLoading={transferMut.isPending}
            disabled={!transfer.amount || !transfer.toUserId}
          >
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>
      <input type="hidden" value={userDisplayName} readOnly />
    </div>
  );
}
