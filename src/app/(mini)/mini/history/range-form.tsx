'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { MiniInput } from '../../_components/mini-field';
import { MiniButton } from '../../_components/mini-button';

export function HistoryRangeForm({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const m = useMessages();
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/mini/history?from=${from}&to=${to}`);
  }

  return (
    <form onSubmit={apply} className="mini-flex" style={{ alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
      <label className="mini-field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
        <span className="mini-field__label">{m.mini.pickPeriod}</span>
        <MiniInput type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
      </label>
      <label className="mini-field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
        <span className="mini-field__label">&nbsp;</span>
        <MiniInput type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
      </label>
      <MiniButton type="submit" inline>
        {m.mini.apply}
      </MiniButton>
    </form>
  );
}
