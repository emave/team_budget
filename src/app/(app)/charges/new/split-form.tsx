'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Checkbox } from 'baseui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createSplitCharge } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';

type Member = { id: string; displayName: string };

export function SplitForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [total, setTotal] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const totalDollars = parseFloat(total || '0');
  const perDefault = selectedIds.length > 0 ? Math.floor((totalDollars / selectedIds.length) * 100) / 100 : 0;

  const allocations = selectedIds.map((id) => ({
    userId: id,
    amount: overrides[id] ? overrides[id] : String(perDefault.toFixed(2)),
  }));

  const mut = useMutation({
    mutationFn: () =>
      createSplitCharge({
        description,
        allocations: allocations.map((a) => ({ userId: a.userId, amount: a.amount })),
      }),
    onSuccess: () => router.push('/charges'),
  });

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
      <FormControl label={m.charges.descriptionLabel}>
        <Input value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </FormControl>
      <FormControl label={m.charges.totalAmountLabel}>
        <Input value={total} onChange={(e) => setTotal(e.currentTarget.value)} placeholder={m.charges.totalPlaceholder} />
      </FormControl>
      <div>
        <h4>{m.charges.membersSectionTitle}</h4>
        {members.map((mm) => {
          const checked = !!selected[mm.id];
          return (
            <div key={mm.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'center', padding: '4px 0' }}>
              <Checkbox checked={checked} onChange={(e) => setSelected((s) => ({ ...s, [mm.id]: e.currentTarget.checked }))}>
                {mm.displayName}
              </Checkbox>
              <Input
                disabled={!checked}
                placeholder={`${perDefault.toFixed(2)}`}
                value={overrides[mm.id] ?? ''}
                onChange={(e) => setOverrides((o) => ({ ...o, [mm.id]: e.currentTarget.value }))}
              />
            </div>
          );
        })}
      </div>
      <Button onClick={() => mut.mutate()} disabled={selectedIds.length === 0 || !description}>
        {m.charges.submitSplit}
      </Button>
      {mut.isError && <div style={{ color: '#dc2626' }}>{(mut.error as Error).message}</div>}
    </div>
  );
}
