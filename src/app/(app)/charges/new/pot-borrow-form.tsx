'use client';

import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createPotBorrow } from '@/server/actions/charges-server';

type Member = { id: string; displayName: string };

interface FormValues {
  userId: string;
  amount: string;
  sourcePot: 'cash' | 'card';
  description: string;
}

export function PotBorrowForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: { userId: '', amount: '', sourcePot: 'cash', description: '' },
  });
  const userId = watch('userId');
  const pot = watch('sourcePot');

  const m = useMutation({
    mutationFn: async (v: FormValues) =>
      createPotBorrow({
        userId: v.userId,
        amount: v.amount,
        sourcePot: v.sourcePot,
        description: v.description,
      }),
    onSuccess: () => router.push('/charges'),
  });

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <FormControl label="Member">
        <Select
          options={members.map((mm) => ({ id: mm.id, label: mm.displayName }))}
          value={userId ? [{ id: userId, label: members.find((mm) => mm.id === userId)?.displayName ?? '' }] : []}
          onChange={({ value }) => setValue('userId', String(value[0]?.id ?? ''))}
          placeholder="Pick a member"
        />
      </FormControl>
      <FormControl label="Amount">
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label="From pot">
        <Select
          options={[{ id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }]}
          value={[{ id: pot, label: pot === 'cash' ? 'Cash' : 'Card' }]}
          onChange={({ value }) => setValue('sourcePot', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
        />
      </FormControl>
      <FormControl label="Description">
        <Input {...(register('description') as object)} />
      </FormControl>
      <Button type="submit" isLoading={m.isPending} disabled={!userId}>Record pot borrow</Button>
      {m.isError && <div style={{ color: '#dc2626' }}>{(m.error as Error).message}</div>}
    </form>
  );
}
