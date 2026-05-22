'use client';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { cancelPayment } from '@/server/actions/payments-server';
import { useMessages } from '@/app/_i18n-provider';
import { RowCancelIcon } from '@/ui/icons';

export function CancelPaymentButton({ id }: { id: string }) {
  const m = useMessages();
  const router = useRouter();
  const mut = useMutation({ mutationFn: () => cancelPayment({ id }), onSuccess: () => router.refresh() });
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      shape={SHAPE.square}
      onClick={() => mut.mutate()}
      isLoading={mut.isPending}
      title={m.common.cancel}
      aria-label={m.common.cancel}
    >
      <RowCancelIcon size={14} />
    </Button>
  );
}
