'use client';

import { Panel } from '@/ui/panel';
import { formatCents } from '@/shared/format';

export function PotCard({ label, cents }: { label: string; cents: number }) {
  return (
    <Panel marginBottom={12}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{formatCents(cents)}</div>
    </Panel>
  );
}
