'use client';

import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createAdhocCharge } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';

type Member = { id: string; displayName: string };

interface FormValues {
  userId: string;
  amount: string;
  description: string;
}

export function AdhocForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({ defaultValues: { userId: '', amount: '', description: '' } });
  const userId = watch('userId');

  const mut = useMutation({
    mutationFn: async (v: FormValues) => createAdhocCharge({ userId: v.userId, amount: v.amount, description: v.description }),
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
      <FormControl label={m.charges.amountLabelEgFormat}>
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label={m.charges.descriptionLabel}>
        <Input {...(register('description') as object)} />
      </FormControl>
      <Button type="submit" isLoading={mut.isPending} disabled={!userId}>{m.charges.submitAdhoc}</Button>
      {mut.isError && <div style={{ color: '#dc2626' }}>{(mut.error as Error).message}</div>}
    </form>
  );
}
