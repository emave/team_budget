'use client';

import { useForm } from 'react-hook-form';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { recordSpending } from '@/server/actions/spendings-server';

type Cat = { id: string; name: string };

interface FormValues {
  pot: 'cash' | 'card';
  amount: string;
  description: string;
  categoryId?: string;
}

export function RecordSpendingForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: { pot: 'cash', amount: '', description: '' } });
  const pot = watch('pot');
  const catId = watch('categoryId');

  const m = useMutation({
    mutationFn: (v: FormValues) =>
      recordSpending({
        pot: v.pot,
        amount: v.amount,
        description: v.description,
        categoryId: v.categoryId || undefined,
      }),
    onSuccess: () => router.push('/spendings'),
  });

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <FormControl label="Pot">
        <Select
          options={[{ id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }]}
          value={[{ id: pot, label: pot === 'cash' ? 'Cash' : 'Card' }]}
          onChange={({ value }) => setValue('pot', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
        />
      </FormControl>
      <FormControl label="Amount">
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label="Description">
        <Input {...(register('description') as object)} />
      </FormControl>
      <FormControl label="Category (optional)">
        <Select
          options={[{ id: '', label: '— none —' }, ...categories.map((c) => ({ id: c.id, label: c.name }))]}
          value={catId !== undefined ? [{ id: catId, label: categories.find((c) => c.id === catId)?.name ?? '— none —' }] : []}
          onChange={({ value }) => setValue('categoryId', value[0]?.id ? String(value[0].id) : undefined)}
          placeholder="None"
        />
      </FormControl>
      <Button type="submit" isLoading={m.isPending}>Record spending</Button>
      {m.isError && <div style={{ color: '#dc2626' }}>{(m.error as Error).message}</div>}
    </form>
  );
}
