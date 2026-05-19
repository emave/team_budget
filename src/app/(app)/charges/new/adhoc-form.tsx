'use client';

import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createAdhocCharge } from '@/server/actions/charges-server';

type Member = { id: string; displayName: string };

interface FormValues {
  userId: string;
  amount: string;
  description: string;
}

export function AdhocForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({ defaultValues: { userId: '', amount: '', description: '' } });
  const userId = watch('userId');

  const m = useMutation({
    mutationFn: async (v: FormValues) => createAdhocCharge({ userId: v.userId, amount: v.amount, description: v.description }),
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
      <FormControl label="Amount (e.g., 12.50)">
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label="Description">
        <Input {...(register('description') as object)} />
      </FormControl>
      <Button type="submit" isLoading={m.isPending} disabled={!userId}>Create charge</Button>
      {m.isError && <div style={{ color: '#dc2626' }}>{(m.error as Error).message}</div>}
    </form>
  );
}
