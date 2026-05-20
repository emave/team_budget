'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { updatePotOpenings } from '@/server/actions/settings-server';
import { formatCents } from '@/shared/format';
import { useMessages } from '@/app/_i18n-provider';

export function PotOpeningsForm({
  cashCents,
  cardCents,
}: {
  cashCents: number;
  cardCents: number;
}) {
  const m = useMessages();
  const router = useRouter();
  const [cash, setCash] = useState((cashCents / 100).toFixed(2));
  const [card, setCard] = useState((cardCents / 100).toFixed(2));
  const save = useMutation({
    mutationFn: () => updatePotOpenings({ cashCents: cash, cardCents: card }),
    onSuccess: () => router.refresh(),
  });

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <FormControl
        label={`${m.settings.potOpeningsCashLabel} (${m.settings.currentLabel(formatCents(cashCents))})`}
      >
        <Input value={cash} onChange={(e) => setCash(e.currentTarget.value)} />
      </FormControl>
      <FormControl
        label={`${m.settings.potOpeningsCardLabel} (${m.settings.currentLabel(formatCents(cardCents))})`}
      >
        <Input value={card} onChange={(e) => setCard(e.currentTarget.value)} />
      </FormControl>
      <div>
        <Button onClick={() => save.mutate()} isLoading={save.isPending}>
          {m.settings.potOpeningsSave}
        </Button>
      </div>
      {save.isError && (
        <div style={{ color: '#dc2626' }}>{(save.error as Error).message}</div>
      )}
      {save.isSuccess && (
        <div style={{ color: '#16a34a' }}>{m.settings.potOpeningsSaved}</div>
      )}
    </div>
  );
}
