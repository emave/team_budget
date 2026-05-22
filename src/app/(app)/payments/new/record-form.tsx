'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, KIND, SIZE } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { recordPayment, suggestFifoAllocation } from '@/server/actions/payments-server';
import { recordCreditDeposit } from '@/server/actions/credit-server';
import { recordGuestDeposit } from '@/server/actions/guest-deposits-server';
import { createGuest as createGuestAction } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';

type Member = { id: string; displayName: string };
type Guest = { id: string; name: string };

interface MemberFormValues {
  payerUserId: string;
  method: 'cash' | 'card';
  amount: string;
  note?: string;
}

export function RecordPaymentForm({ members, guests }: { members: Member[]; guests: Guest[] }) {
  const m = useMessages();
  const router = useRouter();
  const [mode, setMode] = useState<'member' | 'guest'>('member');

  // --- Member branch (unchanged logic) ---
  const { register, handleSubmit, watch, setValue } = useForm<MemberFormValues>({
    defaultValues: { payerUserId: '', method: 'cash', amount: '' },
  });
  const payer = watch('payerUserId');
  const method = watch('method');
  const amount = watch('amount');

  const [depositOnly, setDepositOnly] = useState(false);
  const [allocations, setAllocations] = useState<{ chargeId: string; amount: number }[] | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);

  const suggest = useMutation({
    mutationFn: () => suggestFifoAllocation({ payerUserId: payer, amount }),
    onSuccess: (r) => { setAllocations(r as { chargeId: string; amount: number }[]); setAllocError(null); },
    onError: (e: Error) => { setAllocations(null); setAllocError(e.message); },
  });

  const submit = useMutation({
    mutationFn: (v: MemberFormValues) =>
      depositOnly
        ? recordCreditDeposit({
            payerUserId: v.payerUserId,
            method: v.method,
            amount: v.amount,
            note: v.note,
          })
        : recordPayment({
            payerUserId: v.payerUserId,
            method: v.method,
            amount: v.amount,
            note: v.note,
            allocations: allocations ?? [],
          }),
    onSuccess: () => router.push('/payments'),
  });

  function amountToCents(v: string): number {
    const trimmed = v.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 0;
    const [w, f = ''] = trimmed.split('.');
    return Number(w) * 100 + Number(f.padEnd(2, '0'));
  }
  const allocatedSum = allocations
    ? allocations.reduce((s, a) => s + a.amount, 0)
    : 0;
  const amountCents = amountToCents(amount ?? '');
  const excessCents = !depositOnly && allocations
    ? Math.max(0, amountCents - allocatedSum)
    : 0;
  const payerName = members.find((mm) => mm.id === payer)?.displayName ?? '';

  // --- Guest branch state ---
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestAmount, setGuestAmount] = useState('');
  const [guestMethod, setGuestMethod] = useState<'cash' | 'card'>('cash');
  const [guestNote, setGuestNote] = useState('');

  const submitGuest = useMutation({
    mutationFn: async () => {
      let resolvedId: string | null = guestId;
      const trimmed = guestQuery.trim();
      const exactMatch = guests.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
      if (!resolvedId && trimmed) {
        if (exactMatch) {
          resolvedId = exactMatch.id;
        } else {
          const created = (await createGuestAction({ name: trimmed })) as { id: string };
          resolvedId = created.id;
        }
      }
      return recordGuestDeposit({
        guestId: resolvedId,
        amount: guestAmount,
        method: guestMethod,
        note: guestNote || undefined,
      });
    },
    onSuccess: () => router.push('/guests/deposits'),
  });

  const Toggle = (
    <div style={{ display: 'inline-flex', gap: 8, marginBottom: 16 }}>
      <Button
        kind={mode === 'member' ? KIND.primary : KIND.tertiary}
        size={SIZE.compact}
        onClick={() => setMode('member')}
        type="button"
      >
        {m.guestDeposits.toggleMember}
      </Button>
      <Button
        kind={mode === 'guest' ? KIND.primary : KIND.tertiary}
        size={SIZE.compact}
        onClick={() => setMode('guest')}
        type="button"
      >
        {m.guestDeposits.toggleGuest}
      </Button>
    </div>
  );

  if (mode === 'guest') {
    return (
      <>
        {Toggle}
        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <FormControl label={m.guestDeposits.guestLabel}>
            <Select
              creatable
              options={guests.map((g) => ({ id: g.id, label: g.name }))}
              value={
                guestId
                  ? [{ id: guestId, label: guests.find((g) => g.id === guestId)?.name ?? '' }]
                  : guestQuery
                  ? [{ id: '__new__', label: guestQuery }]
                  : []
              }
              onChange={({ value }) => {
                const v = value[0];
                if (!v) { setGuestId(null); setGuestQuery(''); return; }
                if (typeof v.id === 'string' && v.id !== '__new__' && guests.some((g) => g.id === v.id)) {
                  setGuestId(String(v.id));
                  setGuestQuery('');
                } else {
                  // Creatable entry — id might be the typed string itself
                  setGuestId(null);
                  setGuestQuery(String(v.label ?? v.id));
                }
              }}
              onInputChange={(e) => setGuestQuery(e.currentTarget.value)}
              placeholder={m.guestDeposits.guestPlaceholder}
            />
          </FormControl>
          <FormControl label={m.guestDeposits.methodLabel}>
            <Select
              options={[
                { id: 'cash', label: m.common.methodCash },
                { id: 'card', label: m.common.methodCard },
              ]}
              value={[{ id: guestMethod, label: guestMethod === 'cash' ? m.common.methodCash : m.common.methodCard }]}
              onChange={({ value }) => setGuestMethod((value[0]?.id as 'cash' | 'card') ?? 'cash')}
            />
          </FormControl>
          <FormControl label={m.guestDeposits.amountLabel}>
            <Input value={guestAmount} onChange={(e) => setGuestAmount(e.currentTarget.value)} placeholder="0.00" />
          </FormControl>
          <FormControl label={m.guestDeposits.noteLabel}>
            <Input value={guestNote} onChange={(e) => setGuestNote(e.currentTarget.value)} />
          </FormControl>
          <Button
            type="button"
            onClick={() => submitGuest.mutate()}
            isLoading={submitGuest.isPending}
            disabled={!guestAmount || submitGuest.isPending}
          >
            {m.guestDeposits.submit}
          </Button>
          {submitGuest.isError && (
            <div style={{ color: '#dc2626' }}>{(submitGuest.error as Error).message}</div>
          )}
        </div>
      </>
    );
  }

  // --- Member branch JSX ---
  return (
    <>
      {Toggle}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={depositOnly}
          onChange={(e) => {
            setDepositOnly(e.currentTarget.checked);
            if (e.currentTarget.checked) {
              setAllocations(null);
              setAllocError(null);
            }
          }}
        />
        <span>{m.wallet.depositToggle}</span>
      </label>
      <form onSubmit={handleSubmit((v) => submit.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <FormControl label={m.payments.payerLabel}>
          <Select
            options={members.map((mm) => ({ id: mm.id, label: mm.displayName }))}
            value={payer ? [{ id: payer, label: members.find((mm) => mm.id === payer)?.displayName ?? '' }] : []}
            onChange={({ value }) => setValue('payerUserId', String(value[0]?.id ?? ''))}
          />
        </FormControl>
        <FormControl label={m.payments.methodLabel}>
          <Select
            options={[{ id: 'cash', label: m.common.methodCash }, { id: 'card', label: m.common.methodCard }]}
            value={[{ id: method, label: method === 'cash' ? m.common.methodCash : m.common.methodCard }]}
            onChange={({ value }) => setValue('method', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
          />
        </FormControl>
        <FormControl label={m.payments.amountLabel}>
          <Input {...(register('amount') as object)} placeholder="0.00" />
        </FormControl>
        <FormControl label={m.payments.noteLabel}>
          <Input {...(register('note') as object)} />
        </FormControl>

        {!depositOnly && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="button" onClick={() => suggest.mutate()} disabled={!payer || !amount}>
                {m.payments.suggestFifo}
              </Button>
              {allocError && <span style={{ color: '#dc2626' }}>{allocError}</span>}
            </div>

            {allocations && (
              <div style={{ background: '#f9fafb', padding: 12, borderRadius: 4, fontSize: 13 }}>
                <strong>{m.payments.allocationsHeading}</strong>
                {allocations.map((a, i) => (
                  <div key={i}>
                    {a.chargeId.slice(0, 8)} — {a.amount / 100}
                  </div>
                ))}
                {excessCents > 0 && (
                  <div style={{ marginTop: 8, color: '#065f46' }}>
                    {m.wallet.overAmountNote(
                      (excessCents / 100).toFixed(2),
                      payerName,
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Button
          type="submit"
          isLoading={submit.isPending}
          disabled={!payer || !amount || (!depositOnly && !allocations)}
        >
          {m.payments.submit}
        </Button>
        {submit.isError && <div style={{ color: '#dc2626' }}>{(submit.error as Error).message}</div>}
      </form>
    </>
  );
}
