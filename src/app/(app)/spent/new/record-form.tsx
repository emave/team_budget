'use client';

import { useForm } from 'react-hook-form';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { recordSpending } from '@/server/actions/spendings-server';
import { useMessages } from '@/app/_i18n-provider';
import { SubmitButton } from '@/ui/submit-button';

type Cat = { id: string; name: string };

interface FormValues {
  pot: 'cash' | 'card';
  amount: string;
  description: string;
  categoryId?: string;
}

export function RecordSpendingForm({ categories }: { categories: Cat[] }) {
  const m = useMessages();
  const router = useRouter();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: { pot: 'cash', amount: '', description: '' } });
  const pot = watch('pot');
  const catId = watch('categoryId');

  const mut = useMutation({
    mutationFn: (v: FormValues) =>
      recordSpending({
        pot: v.pot,
        amount: v.amount,
        description: v.description,
        categoryId: v.categoryId || undefined,
      }),
    onSuccess: () => router.push('/spent'),
  });

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12 }}>
      <FormControl label={m.spent.potLabel}>
        <Select
          options={[{ id: 'cash', label: m.common.methodCash }, { id: 'card', label: m.common.methodCard }]}
          value={[{ id: pot, label: pot === 'cash' ? m.common.methodCash : m.common.methodCard }]}
          onChange={({ value }) => setValue('pot', (value[0]?.id as 'cash' | 'card') ?? 'cash')}
        />
      </FormControl>
      <FormControl label={m.spent.amountLabel}>
        <Input {...(register('amount') as object)} placeholder="0.00" />
      </FormControl>
      <FormControl label={m.spent.descriptionLabel}>
        <Input {...(register('description') as object)} />
      </FormControl>
      <FormControl label={m.spent.categoryLabel}>
        <Select
          options={[{ id: '', label: m.common.none_em_dash }, ...categories.map((c) => ({ id: c.id, label: c.name }))]}
          value={catId !== undefined ? [{ id: catId, label: categories.find((c) => c.id === catId)?.name ?? m.common.none_em_dash }] : []}
          onChange={({ value }) => setValue('categoryId', value[0]?.id ? String(value[0].id) : undefined)}
          placeholder={m.spent.categoryPlaceholder}
        />
      </FormControl>
      <SubmitButton type="submit" isLoading={mut.isPending}>{m.spent.submit}</SubmitButton>
      {mut.isError && <div style={{ color: '#dc2626' }}>{(mut.error as Error).message}</div>}
    </form>
  );
}
