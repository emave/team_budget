'use client';

import { Button, KIND } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import {
  deactivateMember,
  reactivateMember,
  changeMemberRole,
} from '@/server/actions/members-server';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';

export function AdminControls({ user }: { user: { id: string; isActive: boolean; role: 'admin' | 'member' } }) {
  const m = useMessages();
  const router = useRouter();
  const deactivate = useMutation({ mutationFn: () => deactivateMember({ id: user.id }), onSuccess: () => router.refresh() });
  const reactivate = useMutation({ mutationFn: () => reactivateMember({ id: user.id }), onSuccess: () => router.refresh() });
  const toggleRole = useMutation({
    mutationFn: () => changeMemberRole({ id: user.id, role: user.role === 'admin' ? 'member' : 'admin' }),
    onSuccess: () => router.refresh(),
  });

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {user.isActive ? (
        <Button kind={KIND.secondary} onClick={() => deactivate.mutate()} isLoading={deactivate.isPending}>
          {m.members.deactivate}
        </Button>
      ) : (
        <Button kind={KIND.secondary} onClick={() => reactivate.mutate()} isLoading={reactivate.isPending}>
          {m.members.reactivate}
        </Button>
      )}
      <Button kind={KIND.secondary} onClick={() => toggleRole.mutate()} isLoading={toggleRole.isPending}>
        {user.role === 'admin' ? m.members.makeMember : m.members.makeAdmin}
      </Button>
    </div>
  );
}
