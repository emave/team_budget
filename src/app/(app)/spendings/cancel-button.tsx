'use client';
import { Button, KIND, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { cancelSpending } from '@/server/actions/spendings-server';
import { useMessages } from '@/app/_i18n-provider';

export function CancelSpendingButton({ id }: { id: string }) {
  const m = useMessages();
  const router = useRouter();
  const mut = useMutation({ mutationFn: () => cancelSpending({ id }), onSuccess: () => router.refresh() });
  return <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => mut.mutate()} isLoading={mut.isPending}>{m.common.cancel}</Button>;
}
