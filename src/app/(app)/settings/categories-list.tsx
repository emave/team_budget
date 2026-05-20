'use client';

import { useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { upsertCategory, archiveCategory } from '@/server/actions/categories-server';
import { useMessages } from '@/app/_i18n-provider';
import { Muted } from '@/ui/text';

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
      <TableBuilder data={categories} emptyMessage={m.common.none}>
        <TableBuilderColumn header={m.settings.colCategory}>
          {(c: Cat) =>
            c.archived ? (
              <Muted>{c.name} {m.common.archived}</Muted>
            ) : (
              <>{c.name}</>
            )
          }
        </TableBuilderColumn>
        <TableBuilderColumn header={m.common.colActions}>
          {(c: Cat) =>
            !c.archived ? (
              <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => archive.mutate(c.id)}>
                {m.settings.archive}
              </Button>
            ) : null
          }
        </TableBuilderColumn>
      </TableBuilder>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Input value={newName} onChange={(e) => setNewName(e.currentTarget.value)} placeholder={m.settings.newCategoryPlaceholder} />
        <Button onClick={() => create.mutate()} disabled={!newName} isLoading={create.isPending}>{m.settings.add}</Button>
      </div>
    </div>
  );
}
