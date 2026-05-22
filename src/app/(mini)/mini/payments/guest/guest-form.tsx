'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useMessages } from '@/app/_i18n-provider';
import { recordGuestDeposit } from '@/server/actions/guest-deposits-server';
import { createGuest } from '@/server/actions/guests-server';

export function GuestDepositForm({ guests }: { guests: { id: string; name: string }[] }) {
  const m = useMessages();
  const router = useRouter();
  const [name, setName] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [note, setNote] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      let guestId: string | null = null;
      if (!anonymous) {
        if (pickedId) {
          guestId = pickedId;
        } else if (name.trim()) {
          const existing = guests.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
          if (existing) guestId = existing.id;
          else {
            const created = (await createGuest({ name: name.trim() })) as { id: string };
            guestId = created.id;
          }
        }
      }
      return recordGuestDeposit({
        guestId,
        amount,
        method,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => router.push('/mini/payments'),
  });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--mini-text)' }}>
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        {m.guestDeposits.guestAnonymousOption}
      </label>
      {!anonymous && (
        <>
          <select
            value={pickedId ?? ''}
            onChange={(e) => { setPickedId(e.target.value || null); setName(''); }}
            style={{ padding: '8px 10px', borderRadius: 6 }}
          >
            <option value="">{m.guestDeposits.guestPlaceholder}</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input
            placeholder={m.guestDeposits.guestPlaceholder}
            value={name}
            onChange={(e) => { setName(e.target.value); setPickedId(null); }}
            style={{ padding: '8px 10px', borderRadius: 6 }}
          />
        </>
      )}
      <input
        placeholder={m.guestDeposits.amountLabel}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 6 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setMethod('cash')}
          aria-pressed={method === 'cash'}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, opacity: method === 'cash' ? 1 : 0.6 }}
        >
          {m.common.methodCash}
        </button>
        <button
          type="button"
          onClick={() => setMethod('card')}
          aria-pressed={method === 'card'}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, opacity: method === 'card' ? 1 : 0.6 }}
        >
          {m.common.methodCard}
        </button>
      </div>
      <input
        placeholder={m.guestDeposits.noteLabel}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 6 }}
      />
      <button
        type="button"
        onClick={() => submit.mutate()}
        disabled={!amount || submit.isPending || (!anonymous && !pickedId && !name.trim())}
        style={{ padding: '10px 12px', borderRadius: 6 }}
      >
        {m.guestDeposits.submit}
      </button>
      {submit.isError && <div style={{ color: '#dc2626' }}>{(submit.error as Error).message}</div>}
    </div>
  );
}
