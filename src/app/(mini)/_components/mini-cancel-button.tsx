'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { cancelCharge } from '@/server/actions/charges-server';
import { cancelPayment } from '@/server/actions/payments-server';
import { cancelSpending } from '@/server/actions/spendings-server';

type Kind = 'charge' | 'payment' | 'spending';

export function MiniCancelButton({ id, kind }: { id: string; kind: Kind }) {
  const m = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(m.mini.confirmCancel)) return;
    startTransition(async () => {
      setError(null);
      try {
        if (kind === 'charge') await cancelCharge({ id });
        else if (kind === 'payment') await cancelPayment({ id });
        else await cancelSpending({ id });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mini-button mini-button--danger mini-button--inline"
      aria-label={m.mini.cancelEntry}
      title={error ?? m.mini.cancelEntry}
    >
      ✕
    </button>
  );
}
