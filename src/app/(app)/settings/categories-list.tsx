'use client';

import { useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { upsertCategory, archiveCategory } from '@/server/actions/categories-server';
import { useMessages } from '@/app/_i18n-provider';

interface Cat { id: string; name: string; archived: boolean }

export function CategoriesList({ categories }: { categories: Cat[] }) {
  const m = useMessages();
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const create = useMutation({
    mutationFn: () => upsertCategory({ name: newName }),
    onSuccess: () => { setNewName(''); router.refresh(); },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveCategory({ id }),
    onSuccess: () => router.refresh(),
  });

  return (
    <div>
      {categories.map((c) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
          <span style={{ color: c.archived ? '#6b7280' : 'inherit' }}>{c.name}{c.archived && ` ${m.common.archived}`}</span>
          {!c.archived && (
            <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => archive.mutate(c.id)}>{m.settings.archive}</Button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Input value={newName} onChange={(e) => setNewName(e.currentTarget.value)} placeholder={m.settings.newCategoryPlaceholder} />
        <Button onClick={() => create.mutate()} disabled={!newName} isLoading={create.isPending}>{m.settings.add}</Button>
      </div>
    </div>
  );
}
