'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { MiniInput, MiniSelect } from '../../_components/mini-field';
import { MiniButton } from '../../_components/mini-button';

interface PersonOption {
  id: string;
  label: string;
}

export function DepositsFilterForm({
  tab,
  initialFrom,
  initialTo,
  initialPersonId,
  personOptions,
}: {
  tab: 'all' | 'members' | 'guests';
  initialFrom: string;
  initialTo: string;
  initialPersonId: string;
  personOptions: PersonOption[];
}) {
  const m = useMessages();
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [personId, setPersonId] = useState(initialPersonId);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('tab', tab);
    params.set('from', from);
    params.set('to', to);
    if (personId) params.set('personId', personId);
    router.push(`/mini/deposits?${params.toString()}`);
  }

  return (
    <form
      onSubmit={apply}
      className="mini-flex"
      style={{ alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}
    >
      <label className="mini-field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
        <span className="mini-field__label">{m.deposits.filterFrom}</span>
        <MiniInput type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
      </label>
      <label className="mini-field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
        <span className="mini-field__label">{m.deposits.filterTo}</span>
        <MiniInput type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
      </label>
      <label className="mini-field" style={{ flex: '2 1 180px', marginBottom: 0 }}>
        <span className="mini-field__label">{m.deposits.filterPerson}</span>
        <MiniSelect value={personId} onChange={(e) => setPersonId(e.currentTarget.value)}>
          <option value="">{m.deposits.filterPersonAll}</option>
          {personOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </MiniSelect>
      </label>
      <MiniButton type="submit" inline>
        {m.deposits.apply}
      </MiniButton>
    </form>
  );
}
