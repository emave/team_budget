'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import {
  updateMonthlyDuesAmount,
  runDuesNow,
} from '@/server/actions/settings-server';
import { formatCents } from '@/shared/format';
import { MiniField, MiniInput } from '../../_components/mini-field';
import { MiniButton } from '../../_components/mini-button';

export function DuesForm({ currentCents }: { currentCents: number }) {
  const m = useMessages();
  const router = useRouter();
  const [amount, setAmount] = useState((currentCents / 100).toFixed(2));
  const [savePending, startSave] = useTransition();
  const [runPending, startRun] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);

  function save() {
    setError(null);
    setGeneratedMsg(null);
    startSave(async () => {
      try {
        await updateMonthlyDuesAmount({ amount });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function run() {
    setError(null);
    setGeneratedMsg(null);
    startRun(async () => {
      try {
        const res = (await runDuesNow()) as { createdCount: number; period: string };
        setGeneratedMsg(m.settings.generatedMsg(res.createdCount, res.period));
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <MiniField label={m.settings.currentLabel(formatCents(currentCents))}>
        <MiniInput
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
        />
      </MiniField>
      <div className="mini-flex">
        <MiniButton type="button" onClick={save} disabled={savePending}>
          {savePending ? '…' : m.settings.saveAmount}
        </MiniButton>
        <MiniButton
          type="button"
          variant="secondary"
          onClick={run}
          disabled={runPending}
        >
          {runPending ? '…' : m.settings.generateNow}
        </MiniButton>
      </div>
      {error && <div className="mini-error">{error}</div>}
      {generatedMsg && (
        <div className="mini-helper" style={{ color: 'var(--mini-success-fg)' }}>
          {generatedMsg}
        </div>
      )}
    </div>
  );
}
