'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import { upsertCategory, archiveCategory } from '@/server/actions/categories-server';
import { MiniInput } from '../../_components/mini-field';
import { MiniButton } from '../../_components/mini-button';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';

interface Cat {
  id: string;
  name: string;
  archived: boolean;
}

export function CategoriesList({ categories }: { categories: Cat[] }) {
  const m = useMessages();
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [createPending, startCreate] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!newName.trim()) return;
    setError(null);
    startCreate(async () => {
      try {
        await upsertCategory({ name: newName.trim() });
        setNewName('');
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function archive(id: string) {
    setError(null);
    setBusyId(id);
    startArchive(async () => {
      try {
        await archiveCategory({ id });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {categories.length === 0 ? (
        <MiniEmpty>{m.common.none}</MiniEmpty>
      ) : (
        categories.map((c) => (
          <MiniRow
            key={c.id}
            title={
              c.archived ? (
                <span style={{ color: 'var(--mini-hint)' }}>
                  {c.name} {m.common.archived}
                </span>
              ) : (
                c.name
              )
            }
            right={
              !c.archived ? (
                <button
                  type="button"
                  className="mini-button mini-button--secondary mini-button--inline"
                  onClick={() => archive(c.id)}
                  disabled={archivePending && busyId === c.id}
                >
                  {m.settings.archive}
                </button>
              ) : null
            }
          />
        ))
      )}
      <div className="mini-flex" style={{ marginTop: 12 }}>
        <MiniInput
          placeholder={m.settings.newCategoryPlaceholder}
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
        />
        <MiniButton
          type="button"
          inline
          onClick={add}
          disabled={createPending || !newName.trim()}
        >
          {m.settings.add}
        </MiniButton>
      </div>
      {error && <div className="mini-error">{error}</div>}
    </div>
  );
}
