'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import {
  createAdhocCharge,
  createPotBorrow,
  createSplitCharge,
} from '@/server/actions/charges-server';
import { MiniField, MiniInput, MiniSelect } from '../../../_components/mini-field';
import { MiniButton } from '../../../_components/mini-button';

type Member = { id: string; displayName: string };
type Mode = 'adhoc' | 'split' | 'pot_borrow';

export function NewChargeForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('adhoc');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Adhoc + pot_borrow shared
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sourcePot, setSourcePot] = useState<'cash' | 'card'>('cash');

  // Split
  const [splitTotal, setSplitTotal] = useState('');
  const [splitSelected, setSplitSelected] = useState<Record<string, boolean>>({});
  const [splitOverrides, setSplitOverrides] = useState<Record<string, string>>({});

  const selectedIds = useMemo(
    () => Object.entries(splitSelected).filter(([, v]) => v).map(([k]) => k),
    [splitSelected]
  );
  const totalDollars = parseFloat(splitTotal || '0');
  const perDefault =
    selectedIds.length > 0 ? Math.floor((totalDollars / selectedIds.length) * 100) / 100 : 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (mode === 'adhoc') {
          await createAdhocCharge({ userId, amount, description });
        } else if (mode === 'pot_borrow') {
          await createPotBorrow({ userId, amount, sourcePot, description });
        } else {
          const allocations = selectedIds.map((id) => ({
            userId: id,
            amount: splitOverrides[id] ? splitOverrides[id] : perDefault.toFixed(2),
          }));
          await createSplitCharge({ description, allocations });
        }
        router.push('/mini/charges');
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <>
      <div className="mini-filterbar">
        <a
          data-active={mode === 'adhoc'}
          onClick={() => setMode('adhoc')}
          style={{ cursor: 'pointer' }}
        >
          {m.charges.tabAdhoc}
        </a>
        <a
          data-active={mode === 'split'}
          onClick={() => setMode('split')}
          style={{ cursor: 'pointer' }}
        >
          {m.charges.tabSplit}
        </a>
        <a
          data-active={mode === 'pot_borrow'}
          onClick={() => setMode('pot_borrow')}
          style={{ cursor: 'pointer' }}
        >
          {m.charges.tabPotBorrow}
        </a>
      </div>

      <form onSubmit={onSubmit}>
        {mode !== 'split' && (
          <>
            <MiniField label={m.charges.memberLabel}>
              <MiniSelect value={userId} onChange={(e) => setUserId(e.currentTarget.value)}>
                <option value="">{m.common.pickAMember}</option>
                {members.map((mm) => (
                  <option key={mm.id} value={mm.id}>
                    {mm.displayName}
                  </option>
                ))}
              </MiniSelect>
            </MiniField>
            <MiniField label={m.charges.amountLabelEgFormat}>
              <MiniInput
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.currentTarget.value)}
              />
            </MiniField>
            {mode === 'pot_borrow' && (
              <MiniField label={m.charges.fromPotLabel}>
                <MiniSelect
                  value={sourcePot}
                  onChange={(e) => setSourcePot(e.currentTarget.value as 'cash' | 'card')}
                >
                  <option value="cash">{m.common.methodCash}</option>
                  <option value="card">{m.common.methodCard}</option>
                </MiniSelect>
              </MiniField>
            )}
            <MiniField label={m.charges.descriptionLabel}>
              <MiniInput
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </MiniField>
            <MiniButton type="submit" disabled={pending || !userId}>
              {pending
                ? '…'
                : mode === 'adhoc'
                  ? m.charges.submitAdhoc
                  : m.charges.submitPotBorrow}
            </MiniButton>
          </>
        )}

        {mode === 'split' && (
          <>
            <MiniField label={m.charges.descriptionLabel}>
              <MiniInput
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </MiniField>
            <MiniField label={m.charges.totalAmountLabel}>
              <MiniInput
                inputMode="decimal"
                placeholder={m.charges.totalPlaceholder}
                value={splitTotal}
                onChange={(e) => setSplitTotal(e.currentTarget.value)}
              />
            </MiniField>
            <h4 style={{ margin: '12px 0 6px', fontSize: 13, color: 'var(--mini-hint)', textTransform: 'uppercase' }}>
              {m.charges.membersSectionTitle}
            </h4>
            {members.map((mm) => {
              const checked = !!splitSelected[mm.id];
              return (
                <div
                  key={mm.id}
                  className="mini-row"
                  style={{ gap: 8, alignItems: 'center' }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSplitSelected((s) => ({ ...s, [mm.id]: e.currentTarget.checked }))
                      }
                    />
                    <span>{mm.displayName}</span>
                  </label>
                  <MiniInput
                    inputMode="decimal"
                    style={{ maxWidth: 120 }}
                    disabled={!checked}
                    placeholder={perDefault.toFixed(2)}
                    value={splitOverrides[mm.id] ?? ''}
                    onChange={(e) =>
                      setSplitOverrides((o) => ({ ...o, [mm.id]: e.currentTarget.value }))
                    }
                  />
                </div>
              );
            })}
            <MiniButton
              type="submit"
              disabled={pending || selectedIds.length === 0 || !description}
            >
              {pending ? '…' : m.charges.submitSplit}
            </MiniButton>
          </>
        )}

        {error && <div className="mini-error">{error}</div>}
      </form>
    </>
  );
}
