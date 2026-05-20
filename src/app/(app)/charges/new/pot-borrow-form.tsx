'use client';

import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createPotBorrow } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';

type Member = { id: string; displayName: string };

interface FormValues {
  userId: string;
  amount: string;
  sourcePot: 'cash' | 'card';
  description: string;
}

export function PotBorrowForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: { userId: '', amount: '', sourcePot: 'cash', description: '' },
  });
  const userId = watch('userId');
  const pot = watch('sourcePot');

  const mut = useMutation({
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
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <FormControl label={m.charges.memberLabel}>
        <Select
          options={members.map((mm) => ({ id: mm.id, label: mm.displayName }))}
          value={userId ? [{ id: userId, label: members.find((mm) => mm.id === userId)?.displayName ?? '' }] : []}
          onChange={({ value }) => setValue('userId', String(value[0]?.id ?? ''))}
          placeholder={m.common.pickAMember}
        />
      </FormControl>
      <FormControl label={m.charges.amountLabel}>
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label={m.charges.fromPotLabel}>
        <Select
          options={[{ id: 'cash', label: m.common.methodCash }, { id: 'card', label: m.common.methodCard }]}
          value={[{ id: pot, label: pot === 'cash' ? m.common.methodCash : m.common.methodCard }]}
          onChange={({ value }) => setValue('sourcePot', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
        />
      </FormControl>
      <FormControl label={m.charges.descriptionLabel}>
        <Input {...(register('description') as object)} />
      </FormControl>
      <Button type="submit" isLoading={mut.isPending} disabled={!userId}>{m.charges.submitPotBorrow}</Button>
      {mut.isError && <div style={{ color: '#dc2626' }}>{(mut.error as Error).message}</div>}
    </form>
  );
}
