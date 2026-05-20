'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { updateMonthlyDuesAmount, runDuesNow } from '@/server/actions/settings-server';
import { formatCents } from '@/shared/format';
import { useMessages } from '@/app/_i18n-provider';

export function DuesForm({ currentCents, currency }: { currentCents: number; currency: string }) {
  const m = useMessages();
  const router = useRouter();
  const [amount, setAmount] = useState((currentCents / 100).toFixed(2));
  const save = useMutation({
    mutationFn: () => updateMonthlyDuesAmount({ amount }),
    onSuccess: () => router.refresh(),
  });
  const run = useMutation({
    mutationFn: () => runDuesNow(),
    onSuccess: () => router.refresh(),
  });

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <FormControl label={m.settings.currentLabel(formatCents(currentCents, currency))}>
        <Input value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />
      </FormControl>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => save.mutate()} isLoading={save.isPending}>{m.settings.saveAmount}</Button>
        <Button onClick={() => run.mutate()} isLoading={run.isPending}>{m.settings.generateNow}</Button>
      </div>
      {save.isError && <div style={{ color: '#dc2626' }}>{(save.error as Error).message}</div>}
      {run.isSuccess && (
        <div style={{ color: '#16a34a' }}>
          {m.settings.generatedMsg(
            (run.data as { createdCount: number; period: string }).createdCount,
            (run.data as { createdCount: number; period: string }).period,
          )}
        </div>
      )}
    </div>
  );
}
