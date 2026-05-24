'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { updatePotOpenings } from '@/server/actions/settings-server';
import { formatCents } from '@/shared/format';
import { MiniField, MiniInput } from '../../_components/mini-field';
import { MiniButton } from '../../_components/mini-button';

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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function save() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await updatePotOpenings({ cashCents: cash, cardCents: card });
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <MiniField
        label={`${m.settings.potOpeningsCashLabel} (${m.settings.currentLabel(formatCents(cashCents))})`}
      >
        <MiniInput
          inputMode="decimal"
          value={cash}
          onChange={(e) => setCash(e.currentTarget.value)}
        />
      </MiniField>
      <MiniField
        label={`${m.settings.potOpeningsCardLabel} (${m.settings.currentLabel(formatCents(cardCents))})`}
      >
        <MiniInput
          inputMode="decimal"
          value={card}
          onChange={(e) => setCard(e.currentTarget.value)}
        />
      </MiniField>
      <MiniButton type="button" onClick={save} disabled={pending}>
        {pending ? '…' : m.settings.potOpeningsSave}
      </MiniButton>
      {error && <div className="mini-error">{error}</div>}
      {success && (
        <div className="mini-helper" style={{ color: 'var(--mini-success-fg)' }}>
          {m.settings.potOpeningsSaved}
        </div>
      )}
    </div>
  );
}
