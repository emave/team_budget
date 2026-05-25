'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';
import {
  listOpenChargesForPayer,
  recordPayment,
} from '@/server/actions/payments-server';
import { formatCents } from '@/shared/format';
import type { Messages } from '@/shared/i18n';
import { MiniField, MiniInput, MiniSelect } from '../../../_components/mini-field';
import { MiniButton } from '../../../_components/mini-button';

type Member = { id: string; displayName: string };

interface OpenChargeForPayer {
  id: string;
  type: 'monthly_dues' | 'out_of_bounds' | 'adhoc' | 'pot_borrow';
  description: string;
  amount: number;
  allocatedCents: number;
  remainingCents: number;
  billingPeriod: string | null;
  createdAt: string;
}

const CHARGE_TYPE_KEY: Record<string, keyof Messages['owed']> = {
  monthly_dues: 'typeMonthlyDues',
  adhoc: 'typeAdhoc',
  pot_borrow: 'typePotBorrow',
  out_of_bounds: 'typeOutOfBounds',
};

function amountToCents(v: string): number {
  const trimmed = v.trim();
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 0;
  const [w, f = ''] = trimmed.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}

function centsToAmount(cents: number): string {
  if (cents <= 0) return '';
  const whole = Math.floor(cents / 100);
  const rem = cents % 100;
  return `${whole}.${rem.toString().padStart(2, '0')}`;
}

function autoFillDues(charges: OpenChargeForPayer[], amountCents: number) {
  let remaining = amountCents;
  const out: Record<string, string> = {};
  for (const c of charges) {
    if (c.type !== 'monthly_dues') continue;
    if (remaining <= 0) break;
    const take = Math.min(c.remainingCents, remaining);
    if (take <= 0) continue;
    out[c.id] = centsToAmount(take);
    remaining -= take;
  }
  return out;
}

export function RecordPaymentForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const [payerUserId, setPayerUserId] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [openCharges, setOpenCharges] = useState<OpenChargeForPayer[]>([]);
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [chargesLoading, setChargesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = amountToCents(amount);
  const payerName = members.find((mm) => mm.id === payerUserId)?.displayName ?? '';

  // Fetch open charges when payer changes
  useEffect(() => {
    if (!payerUserId) {
      setOpenCharges([]);
      setAllocInputs({});
      return;
    }
    setChargesLoading(true);
    listOpenChargesForPayer({ payerUserId })
      .then((rows) => {
        setOpenCharges(rows as OpenChargeForPayer[]);
        setAllocInputs(autoFillDues(rows as OpenChargeForPayer[], amountCents));
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setChargesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payerUserId]);

  const allocatedSum = useMemo(() => {
    let s = 0;
    for (const c of openCharges) {
      const v = allocInputs[c.id];
      if (!v) continue;
      const cents = amountToCents(v);
      if (cents > 0) s += cents;
    }
    return s;
  }, [allocInputs, openCharges]);

  const excessCents = amountCents - allocatedSum;
  const allocationsExceed = excessCents < 0;
  const submitDisabled =
    !payerUserId || amountCents <= 0 || allocationsExceed || pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const allocations: { chargeId: string; amount: number }[] = [];
        for (const c of openCharges) {
          const v = allocInputs[c.id];
          if (!v) continue;
          const cents = amountToCents(v);
          if (cents > 0) allocations.push({ chargeId: c.id, amount: cents });
        }
        await recordPayment({
          payerUserId,
          method,
          amount: amountCents,
          note: note.trim() || undefined,
          allocations,
        });
        router.push('/mini/payments');
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <MiniField label={m.payments.payerLabel}>
        <MiniSelect
          value={payerUserId}
          onChange={(e) => setPayerUserId(e.currentTarget.value)}
        >
          <option value="">{m.common.pickAMember}</option>
          {members.map((mm) => (
            <option key={mm.id} value={mm.id}>
              {mm.displayName}
            </option>
          ))}
        </MiniSelect>
      </MiniField>

      <MiniField label={m.payments.methodLabel}>
        <MiniSelect
          value={method}
          onChange={(e) => setMethod(e.currentTarget.value as 'cash' | 'card')}
        >
          <option value="cash">{m.common.methodCash}</option>
          <option value="card">{m.common.methodCard}</option>
        </MiniSelect>
      </MiniField>

      <MiniField label={m.payments.amountLabel}>
        <MiniInput
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
        />
      </MiniField>

      <MiniField label={m.payments.noteLabel}>
        <MiniInput value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </MiniField>

      {payerUserId && (
        <div className="mini-card" style={{ padding: 12, marginBottom: 12 }}>
          <strong>{m.payments.allocationsHeading}</strong>
          {chargesLoading && (
            <div className="mini-helper" style={{ marginTop: 6 }}>…</div>
          )}
          {!chargesLoading && openCharges.length === 0 && (
            <div className="mini-helper" style={{ marginTop: 6 }}>
              {m.payments.noOpenChargesHint(payerName)}
            </div>
          )}
          {!chargesLoading &&
            openCharges.map((c) => {
              const typeKey = CHARGE_TYPE_KEY[c.type];
              const typeLabel = typeKey ? (m.owed[typeKey] as string) : c.type;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    margin: '8px 0',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <span style={{ color: 'var(--mini-hint)' }}>{typeLabel}</span>
                    {' — '}
                    {c.description}
                    <div className="mini-helper">
                      {m.payments.allocRemaining}: {formatCents(c.remainingCents)}
                    </div>
                  </div>
                  <MiniInput
                    inputMode="decimal"
                    style={{ maxWidth: 120 }}
                    placeholder="0.00"
                    value={allocInputs[c.id] ?? ''}
                    onChange={(e) =>
                      setAllocInputs((prev) => ({
                        ...prev,
                        [c.id]: e.currentTarget.value,
                      }))
                    }
                  />
                </div>
              );
            })}
          {openCharges.length > 0 && (
            <div className="mini-helper" style={{ marginTop: 4 }}>
              {m.payments.allocTotal(formatCents(allocatedSum), formatCents(amountCents))}
            </div>
          )}
          {amountCents > 0 && !allocationsExceed && excessCents > 0 && payerName && (
            <div className="mini-helper" style={{ color: 'var(--mini-success-fg)' }}>
              {m.payments.excessToWallet(formatCents(excessCents), payerName)}
            </div>
          )}
          {allocationsExceed && (
            <div className="mini-error">{m.payments.allocationsExceed}</div>
          )}
        </div>
      )}

      <MiniButton type="submit" disabled={submitDisabled}>
        {pending ? '…' : m.payments.submit}
      </MiniButton>
      {error && <div className="mini-error">{error}</div>}
    </form>
  );
}
