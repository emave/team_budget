'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Checkbox } from 'baseui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createSplitCharge } from '@/server/actions/charges-server';

type Member = { id: string; displayName: string };

export function SplitForm({ members }: { members: Member[] }) {
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

  const m = useMutation({
    mutationFn: () =>
      createSplitCharge({
        description,
        allocations: allocations.map((a) => ({ userId: a.userId, amount: a.amount })),
      }),
    onSuccess: () => router.push('/charges'),
  });

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
      <FormControl label="Description">
        <Input value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </FormControl>
      <FormControl label="Total amount (defaults to equal split)">
        <Input value={total} onChange={(e) => setTotal(e.currentTarget.value)} placeholder="e.g. 480.00" />
      </FormControl>
      <div>
        <h4>Members</h4>
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
      <Button onClick={() => m.mutate()} disabled={selectedIds.length === 0 || !description}>
        Create split charge
      </Button>
      {m.isError && <div style={{ color: '#dc2626' }}>{(m.error as Error).message}</div>}
    </div>
  );
}
