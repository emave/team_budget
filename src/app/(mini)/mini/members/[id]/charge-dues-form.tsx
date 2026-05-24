'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { chargeMemberDues } from '@/server/actions/charges-server';
import { formatCents } from '@/shared/format';
import { MiniField, MiniInput } from '../../../_components/mini-field';
import { MiniButton } from '../../../_components/mini-button';

function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mm}`;
}

export function MiniChargeDuesForm({
  userId,
  monthlyDuesAmount,
}: {
  userId: string;
  monthlyDuesAmount: number;
}) {
  const m = useMessages();
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod());
  const [pending, startTransition] = useTransition();
  const [conflict, setConflict] = useState<{ period: string; status: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConflict(null);
    setSuccess(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await chargeMemberDues({ userId, period });
        if (res.ok) {
          setSuccess(true);
          router.refresh();
        } else {
          setConflict({ period, status: res.existingStatus });
        }
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (monthlyDuesAmount <= 0) {
    return <div className="mini-helper">{m.members.dues.noAmountConfigured}</div>;
  }

  return (
    <form onSubmit={onSubmit}>
      <MiniField label={m.members.dues.monthLabel}>
        <MiniInput
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.currentTarget.value)}
        />
      </MiniField>
      <MiniButton type="submit" disabled={pending}>
        {pending ? '…' : m.members.dues.chargeButton(formatCents(monthlyDuesAmount))}
      </MiniButton>
      {conflict && (
        <div className="mini-error">
          {m.members.dues.alreadyCharged(conflict.period, conflict.status)}
        </div>
      )}
      {success && (
        <div className="mini-helper" style={{ color: 'var(--mini-success-fg)' }}>
          {m.members.dues.successAck}
        </div>
      )}
      {error && <div className="mini-error">{error}</div>}
    </form>
  );
}
