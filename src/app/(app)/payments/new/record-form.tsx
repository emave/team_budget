'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { recordPayment, suggestFifoAllocation } from '@/server/actions/payments-server';

type Member = { id: string; displayName: string };

interface FormValues {
  payerUserId: string;
  method: 'cash' | 'card';
  amount: string;
  note?: string;
}

export function RecordPaymentForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: { payerUserId: '', method: 'cash', amount: '' } });
  const payer = watch('payerUserId');
  const method = watch('method');
  const amount = watch('amount');

  const [allocations, setAllocations] = useState<{ chargeId: string; amount: number }[] | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);

  const suggest = useMutation({
    mutationFn: () => suggestFifoAllocation({ payerUserId: payer, amount }),
    onSuccess: (r) => { setAllocations(r as { chargeId: string; amount: number }[]); setAllocError(null); },
    onError: (e: Error) => { setAllocations(null); setAllocError(e.message); },
  });

  const submit = useMutation({
    mutationFn: (v: FormValues) =>
      recordPayment({
        payerUserId: v.payerUserId,
        method: v.method,
        amount: v.amount,
        note: v.note,
        allocations: allocations ?? [],
      }),
    onSuccess: () => router.push('/payments'),
  });

  return (
    <form onSubmit={handleSubmit((v) => submit.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <FormControl label="Payer">
        <Select
          options={members.map((m) => ({ id: m.id, label: m.displayName }))}
          value={payer ? [{ id: payer, label: members.find((m) => m.id === payer)?.displayName ?? '' }] : []}
          onChange={({ value }) => setValue('payerUserId', String(value[0]?.id ?? ''))}
        />
      </FormControl>
      <FormControl label="Method">
        <Select
          options={[{ id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }]}
          value={[{ id: method, label: method === 'cash' ? 'Cash' : 'Card' }]}
          onChange={({ value }) => setValue('method', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
        />
      </FormControl>
      <FormControl label="Amount">
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label="Note (optional)">
        <Input {...(register('note') as object)} />
      </FormControl>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="button" onClick={() => suggest.mutate()} disabled={!payer || !amount}>
          Suggest FIFO allocation
        </Button>
        {allocError && <span style={{ color: '#dc2626' }}>{allocError}</span>}
      </div>

      {allocations && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 4, fontSize: 13 }}>
          <strong>Allocations:</strong>
          {allocations.map((a, i) => (
            <div key={i}>
              {a.chargeId.slice(0, 8)} — {a.amount / 100}
            </div>
          ))}
        </div>
      )}

      <Button type="submit" isLoading={submit.isPending} disabled={!payer || !amount || !allocations}>
        Record payment
      </Button>
      {submit.isError && <div style={{ color: '#dc2626' }}>{(submit.error as Error).message}</div>}
    </form>
  );
}
