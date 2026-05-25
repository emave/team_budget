'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  recordPayment,
  listOpenChargesForPayer,
} from '@/server/actions/payments-server';
import { SubmitButton } from '@/ui/submit-button';

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
import { recordGuestDeposit } from '@/server/actions/guest-deposits-server';
import { createGuest as createGuestAction } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';
import type { Messages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';

type Member = { id: string; displayName: string };
type Guest = { id: string; name: string };

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

function autoFillDues(charges: OpenChargeForPayer[], amountCents: number): Record<string, string> {
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

export function RecordPaymentForm({ members, guests }: { members: Member[]; guests: Guest[] }) {
  const m = useMessages();
  const router = useRouter();
  const [mode, setMode] = useState<'member' | 'guest'>('member');

  // --- Member branch state ---
  const [payerUserId, setPayerUserId] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});

  const openCharges = useQuery({
    queryKey: ['open-charges-for-payer', payerUserId],
    enabled: payerUserId !== '',
    queryFn: () => listOpenChargesForPayer({ payerUserId }) as Promise<OpenChargeForPayer[]>,
  });

  const amountCents = amountToCents(amount);
  const payerName = members.find((mm) => mm.id === payerUserId)?.displayName ?? '';

  // Re-prefill allocations whenever the payer's open charges arrive.
  useEffect(() => {
    if (!openCharges.data) {
      setAllocInputs({});
      return;
    }
    setAllocInputs(autoFillDues(openCharges.data, amountCents));
    // Intentionally not depending on amountCents: pre-fill runs only when the
    // payer's open-charges fetch resolves. Manual edits to the amount don't
    // overwrite the admin's allocation edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCharges.data]);

  const allocatedSum = useMemo(() => {
    if (!openCharges.data) return 0;
    let s = 0;
    for (const c of openCharges.data) {
      const v = allocInputs[c.id];
      if (!v) continue;
      const cents = amountToCents(v);
      if (cents > 0) s += cents;
    }
    return s;
  }, [allocInputs, openCharges.data]);

  const excessCents = amountCents - allocatedSum;
  const allocationsExceed = excessCents < 0;

  const submit = useMutation({
    mutationFn: () => {
      const allocations: { chargeId: string; amount: number }[] = [];
      for (const c of openCharges.data ?? []) {
        const v = allocInputs[c.id];
        if (!v) continue;
        const cents = amountToCents(v);
        if (cents > 0) allocations.push({ chargeId: c.id, amount: cents });
      }
      return recordPayment({
        payerUserId,
        method,
        amount: amountCents,
        note: note.trim() || undefined,
        allocations,
      });
    },
    onSuccess: () => router.push('/payments'),
  });

  // --- Guest branch state (unchanged) ---
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestAmount, setGuestAmount] = useState('');
  const [guestMethod, setGuestMethod] = useState<'cash' | 'card'>('cash');
  const [guestNote, setGuestNote] = useState('');

  const submitGuest = useMutation({
    mutationFn: async () => {
      let resolvedId: string | null = guestId;
      const trimmed = guestQuery.trim();
      const exactMatch = guests.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
      if (!resolvedId && trimmed) {
        if (exactMatch) {
          resolvedId = exactMatch.id;
        } else {
          const created = (await createGuestAction({ name: trimmed })) as { id: string };
          resolvedId = created.id;
        }
      }
      return recordGuestDeposit({
        guestId: resolvedId,
        amount: guestAmount,
        method: guestMethod,
        note: guestNote || undefined,
      });
    },
    onSuccess: () => router.push('/deposits?tab=guests'),
  });

  const Toggle = (
    <div style={{ display: 'inline-flex', gap: 8, marginBottom: 16 }}>
      <Button
        kind={mode === 'member' ? KIND.primary : KIND.tertiary}
        size={SIZE.compact}
        onClick={() => setMode('member')}
        type="button"
      >
        {m.guestDeposits.toggleMember}
      </Button>
      <Button
        kind={mode === 'guest' ? KIND.primary : KIND.tertiary}
        size={SIZE.compact}
        onClick={() => setMode('guest')}
        type="button"
      >
        {m.guestDeposits.toggleGuest}
      </Button>
    </div>
  );

  if (mode === 'guest') {
    return (
      <>
        {Toggle}
        <div style={{ display: 'grid', gap: 12 }}>
          <FormControl label={m.guestDeposits.guestLabel}>
            <Select
              creatable
              options={guests.map((g) => ({ id: g.id, label: g.name }))}
              value={
                guestId
                  ? [{ id: guestId, label: guests.find((g) => g.id === guestId)?.name ?? '' }]
                  : guestQuery
                  ? [{ id: '__new__', label: guestQuery }]
                  : []
              }
              onChange={({ value }) => {
                const v = value[0];
                if (!v) { setGuestId(null); setGuestQuery(''); return; }
                if (typeof v.id === 'string' && v.id !== '__new__' && guests.some((g) => g.id === v.id)) {
                  setGuestId(String(v.id));
                  setGuestQuery('');
                } else {
                  setGuestId(null);
                  setGuestQuery(String(v.label ?? v.id));
                }
              }}
              onInputChange={(e) => setGuestQuery(e.currentTarget.value)}
              placeholder={m.guestDeposits.guestPlaceholder}
            />
          </FormControl>
          <FormControl label={m.guestDeposits.methodLabel}>
            <Select
              options={[
                { id: 'cash', label: m.common.methodCash },
                { id: 'card', label: m.common.methodCard },
              ]}
              value={[{ id: guestMethod, label: guestMethod === 'cash' ? m.common.methodCash : m.common.methodCard }]}
              onChange={({ value }) => setGuestMethod((value[0]?.id as 'cash' | 'card') ?? 'cash')}
            />
          </FormControl>
          <FormControl label={m.guestDeposits.amountLabel}>
            <Input value={guestAmount} onChange={(e) => setGuestAmount(e.currentTarget.value)} placeholder="0.00" />
          </FormControl>
          <FormControl label={m.guestDeposits.noteLabel}>
            <Input value={guestNote} onChange={(e) => setGuestNote(e.currentTarget.value)} />
          </FormControl>
          <SubmitButton
            type="button"
            onClick={() => submitGuest.mutate()}
            isLoading={submitGuest.isPending}
            disabled={!guestAmount || submitGuest.isPending}
          >
            {m.guestDeposits.submit}
          </SubmitButton>
          {submitGuest.isError && (
            <div style={{ color: '#dc2626' }}>{(submitGuest.error as Error).message}</div>
          )}
        </div>
      </>
    );
  }

  // --- Member branch JSX ---
  const charges = openCharges.data ?? [];
  const submitDisabled =
    !payerUserId || amountCents <= 0 || allocationsExceed || submit.isPending;

  return (
    <>
      {Toggle}
      <div style={{ display: 'grid', gap: 12 }}>
        <FormControl label={m.payments.payerLabel}>
          <Select
            options={members.map((mm) => ({ id: mm.id, label: mm.displayName }))}
            value={
              payerUserId
                ? [{ id: payerUserId, label: members.find((mm) => mm.id === payerUserId)?.displayName ?? '' }]
                : []
            }
            onChange={({ value }) => setPayerUserId(String(value[0]?.id ?? ''))}
          />
        </FormControl>
        <FormControl label={m.payments.methodLabel}>
          <Select
            options={[
              { id: 'cash', label: m.common.methodCash },
              { id: 'card', label: m.common.methodCard },
            ]}
            value={[{ id: method, label: method === 'cash' ? m.common.methodCash : m.common.methodCard }]}
            onChange={({ value }) => setMethod((value[0]?.id as 'cash' | 'card') ?? 'cash')}
          />
        </FormControl>
        <FormControl label={m.payments.amountLabel}>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            placeholder="0.00"
          />
        </FormControl>
        <FormControl label={m.payments.noteLabel}>
          <Input value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        </FormControl>

        {payerUserId && (
          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
            <strong>{m.payments.allocationsHeading}</strong>
            {openCharges.isLoading && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>…</div>
            )}
            {!openCharges.isLoading && charges.length === 0 && (
              <div style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
                {m.payments.noOpenChargesHint(payerName)}
              </div>
            )}
            {!openCharges.isLoading && charges.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '4px 8px 4px 0' }}>{m.payments.allocCharge}</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>{m.payments.allocRemaining}</th>
                    <th style={{ padding: '4px 0', textAlign: 'right', width: 140 }}>{m.payments.allocAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => {
                    const typeKey = CHARGE_TYPE_KEY[c.type];
                    const typeLabel = typeKey ? (m.owed[typeKey] as string) : c.type;
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px 8px 6px 0' }}>
                          <span style={{ color: '#6b7280' }}>{typeLabel}</span>
                          {' — '}
                          <span>{c.description}</span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>
                          {formatCents(c.remainingCents)}
                        </td>
                        <td style={{ padding: '6px 0', textAlign: 'right' }}>
                          <Input
                            value={allocInputs[c.id] ?? ''}
                            onChange={(e) =>
                              setAllocInputs((prev) => ({ ...prev, [c.id]: e.currentTarget.value }))
                            }
                            placeholder="0.00"
                            size={SIZE.compact}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid #d1d5db' }}>
                    <td colSpan={2} style={{ padding: '8px 8px 0 0', color: '#374151' }}>
                      {m.payments.allocTotal(formatCents(allocatedSum), formatCents(amountCents))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              </div>
            )}
            {amountCents > 0 && !allocationsExceed && excessCents > 0 && payerName && (
              <div style={{ marginTop: 8, color: '#065f46' }}>
                {m.payments.excessToWallet(formatCents(excessCents), payerName)}
              </div>
            )}
            {allocationsExceed && (
              <div style={{ marginTop: 8, color: '#dc2626' }}>
                {m.payments.allocationsExceed}
              </div>
            )}
          </div>
        )}

        <SubmitButton
          type="button"
          onClick={() => submit.mutate()}
          isLoading={submit.isPending}
          disabled={submitDisabled}
        >
          {m.payments.submit}
        </SubmitButton>
        {submit.isError && (
          <div style={{ color: '#dc2626' }}>{(submit.error as Error).message}</div>
        )}
      </div>
    </>
  );
}
