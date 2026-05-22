'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { chargeMemberDues } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';

interface Props {
  userId: string;
  monthlyDuesAmount: number;
}

interface FormValues {
  period: string;
}

function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ChargeDuesForm({ userId, monthlyDuesAmount }: Props) {
  const m = useMessages();
  const router = useRouter();
  const [conflict, setConflict] = useState<{ period: string; status: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    defaultValues: { period: currentPeriod() },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setConflict(null);
      setSuccess(false);
      return chargeMemberDues({ userId, period: values.period });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setSuccess(true);
        router.refresh();
        return;
      }
      setConflict({ period: getValues('period'), status: res.existingStatus });
    },
  });

  if (monthlyDuesAmount <= 0) {
    return <div>{m.members.dues.noAmountConfigured}</div>;
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Controller
            control={control}
            name="period"
            render={({ field }) => (
              <FormControl label={m.members.dues.monthLabel}>
                <Input
                  type="month"
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                />
              </FormControl>
            )}
          />
        </div>
        <Button type="submit" isLoading={mutation.isPending} overrides={{ BaseButton: { style: { flex: '1 1 200px' } } }}>
          {m.members.dues.chargeButton(formatCents(monthlyDuesAmount))}
        </Button>
      </div>
      {conflict && (
        <div style={{ color: '#b00', marginTop: 8 }}>
          {m.members.dues.alreadyCharged(conflict.period, conflict.status)}
        </div>
      )}
      {success && (
        <div style={{ color: '#080', marginTop: 8 }}>{m.members.dues.successAck}</div>
      )}
    </form>
  );
}
