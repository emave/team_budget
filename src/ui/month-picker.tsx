'use client';

import { useState } from 'react';
import { StatefulPopover, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { useLocale, useMessages } from '@/app/_i18n-provider';
import { formatPeriodLong, parsePeriod } from '@/shared/i18n';

interface Props {
  value: string;
  onChange: (period: string) => void;
  disabled?: boolean;
}

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function MonthPicker({ value, onChange, disabled }: Props) {
  const m = useMessages();
  const locale = useLocale();
  const monthsShort = m.common.monthsShort;
  const parsed = parsePeriod(value) ?? currentYearMonth();
  const today = currentYearMonth();
  const [viewYear, setViewYear] = useState(parsed.year);

  return (
    <StatefulPopover
      placement={PLACEMENT.bottomLeft}
      triggerType={TRIGGER_TYPE.click}
      onOpen={() => setViewYear(parsePeriod(value)?.year ?? today.year)}
      content={({ close }) => (
        <div style={{ padding: 12, minWidth: 260 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Button
              size={SIZE.compact}
              kind={KIND.tertiary}
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              ◀
            </Button>
            <strong>{viewYear}</strong>
            <Button
              size={SIZE.compact}
              kind={KIND.tertiary}
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
            >
              ▶
            </Button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}
          >
            {monthsShort.map((label, idx) => {
              const month = idx + 1;
              const isSelected = viewYear === parsed.year && month === parsed.month;
              const isCurrent = viewYear === today.year && month === today.month;
              return (
                <Button
                  key={month}
                  size={SIZE.compact}
                  type="button"
                  kind={isSelected ? KIND.primary : KIND.tertiary}
                  overrides={
                    !isSelected && isCurrent
                      ? {
                          BaseButton: {
                            style: {
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              borderColor: '#3b82f6',
                            },
                          },
                        }
                      : undefined
                  }
                  onClick={() => {
                    const period = `${viewYear}-${String(month).padStart(2, '0')}`;
                    onChange(period);
                    close();
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    >
      <div style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <Input
          value={formatPeriodLong(value, locale)}
          readOnly
          disabled={disabled}
          overrides={{
            Input: { style: { cursor: disabled ? 'not-allowed' : 'pointer' } },
          }}
        />
      </div>
    </StatefulPopover>
  );
}
