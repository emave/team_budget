'use client';

import { Card, StyledBody } from 'baseui/card';
import { formatCents } from '@/shared/format';

export function PotCard({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  return (
    <Card overrides={{ Root: { style: { width: '100%' } } }}>
      <StyledBody>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{formatCents(cents, currency)}</div>
      </StyledBody>
    </Card>
  );
}
