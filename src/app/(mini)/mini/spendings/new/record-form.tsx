'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { recordSpending } from '@/server/actions/spendings-server';
import { MiniField, MiniInput, MiniSelect } from '../../../_components/mini-field';
import { MiniButton } from '../../../_components/mini-button';

type Cat = { id: string; name: string };

export function RecordSpendingForm({ categories }: { categories: Cat[] }) {
  const m = useMessages();
  const router = useRouter();
  const [pot, setPot] = useState<'cash' | 'card'>('cash');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await recordSpending({
          pot,
          amount,
          description,
          categoryId: categoryId || undefined,
        });
        router.push('/mini/spendings');
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <MiniField label={m.spendings.potLabel}>
        <MiniSelect value={pot} onChange={(e) => setPot(e.currentTarget.value as 'cash' | 'card')}>
          <option value="cash">{m.common.methodCash}</option>
          <option value="card">{m.common.methodCard}</option>
        </MiniSelect>
      </MiniField>
      <MiniField label={m.spendings.amountLabel}>
        <MiniInput
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
        />
      </MiniField>
      <MiniField label={m.spendings.descriptionLabel}>
        <MiniInput
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
      </MiniField>
      <MiniField label={m.spendings.categoryLabel}>
        <MiniSelect
          value={categoryId}
          onChange={(e) => setCategoryId(e.currentTarget.value)}
        >
          <option value="">{m.common.none_em_dash}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </MiniSelect>
      </MiniField>
      <MiniButton type="submit" disabled={pending}>
        {pending ? '…' : m.spendings.submit}
      </MiniButton>
      {error && <div className="mini-error">{error}</div>}
    </form>
  );
}
