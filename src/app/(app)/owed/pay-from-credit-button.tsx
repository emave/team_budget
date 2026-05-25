'use client';

import { Button, KIND, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { applyCreditToCharge } from '@/server/actions/credit-server';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';

interface Props {
  chargeId: string;
  remainingCents: number;
  creditAvailableCents: number;
}

export function PayFromCreditButton({ chargeId, remainingCents, creditAvailableCents }: Props) {
  const m = useMessages();
  const router = useRouter();
  const applyAmount = Math.min(remainingCents, creditAvailableCents);
  const mut = useMutation({
    mutationFn: () => applyCreditToCharge({ chargeId, amount: applyAmount }),
    onSuccess: () => router.refresh(),
  });
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      onClick={() => {
        if (window.confirm(m.wallet.payFromCreditConfirm(formatCents(applyAmount)))) {
          mut.mutate();
        }
      }}
      isLoading={mut.isPending}
    >
      {m.wallet.payFromCreditCta(formatCents(creditAvailableCents))}
    </Button>
  );
}
