'use client';
import { Button, KIND, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { cancelSpending } from '@/server/actions/spendings-server';

export function CancelSpendingButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useMutation({ mutationFn: () => cancelSpending({ id }), onSuccess: () => router.refresh() });
  return <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => m.mutate()} isLoading={m.isPending}>Cancel</Button>;
}
