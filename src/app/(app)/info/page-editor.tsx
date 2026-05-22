'use client';

import { useState } from 'react';
import { Button, KIND } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Textarea } from 'baseui/textarea';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { upsertInfoPage, deleteInfoPage } from '@/server/actions/info-pages-server';
import { useMessages } from '@/app/_i18n-provider';
import { ActionSaveIcon } from '@/ui/icons';

interface Page { id: string; title: string; body: string }

export function PageEditor({ mode, page }: { mode: 'create' | 'edit'; page?: Page }) {
  const m = useMessages();
  const router = useRouter();
  const [title, setTitle] = useState(page?.title ?? '');
  const [body, setBody] = useState(page?.body ?? '');
  const [open, setOpen] = useState(mode === 'create');

  const save = useMutation({
    mutationFn: () => upsertInfoPage({ id: page?.id, title, body }),
    onSuccess: () => { router.refresh(); if (mode === 'create') { setTitle(''); setBody(''); } else setOpen(false); },
  });
  const remove = useMutation({
    mutationFn: () => deleteInfoPage({ id: page!.id }),
    onSuccess: () => router.refresh(),
  });

  if (mode === 'edit' && !open) {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button kind={KIND.tertiary} onClick={() => setOpen(true)}>{m.info.edit}</Button>
        <Button
          kind={KIND.tertiary}
          onClick={() => remove.mutate()}
          isLoading={remove.isPending}
        >
          {m.info.deleteBtn}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
      <FormControl label={m.info.titleLabel}>
        <Input value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      </FormControl>
      <FormControl label={m.info.bodyLabel}>
        <Textarea value={body} onChange={(e) => setBody(e.currentTarget.value)} rows={6} />
      </FormControl>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button startEnhancer={<ActionSaveIcon />} onClick={() => save.mutate()} isLoading={save.isPending} disabled={!title}>
          {mode === 'create' ? m.info.create : m.info.save}
        </Button>
        {mode === 'edit' && (
          <Button kind={KIND.tertiary} onClick={() => { setOpen(false); setTitle(page?.title ?? ''); setBody(page?.body ?? ''); }}>
            {m.info.cancel}
          </Button>
        )}
      </div>
    </div>
  );
}
