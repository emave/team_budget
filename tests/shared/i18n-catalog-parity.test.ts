import { describe, expect, it } from 'vitest';
import { MESSAGES_EN } from '../../src/shared/i18n/messages-en';
import { MESSAGES_RU } from '../../src/shared/i18n/messages-ru';

type AnyRecord = Record<string, unknown>;

function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  if (typeof node === 'function') return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(node as AnyRecord)) {
    out.push(...collectKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

function shapeOf(node: unknown): string {
  if (typeof node === 'function') return 'fn';
  if (typeof node === 'string') return 'string';
  if (typeof node !== 'object' || node === null) return typeof node;
  return 'object';
}

function compareShapes(a: unknown, b: unknown, path = ''): string[] {
  const errors: string[] = [];
  if (shapeOf(a) !== shapeOf(b)) {
    errors.push(`shape mismatch at "${path || '<root>'}": en=${shapeOf(a)} ru=${shapeOf(b)}`);
    return errors;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    for (const [k, v] of Object.entries(a as AnyRecord)) {
      errors.push(...compareShapes(v, (b as AnyRecord)[k], path ? `${path}.${k}` : k));
    }
  }
  return errors;
}

describe('i18n catalog parity', () => {
  it('EN and RU have identical key sets', () => {
    const en = new Set(collectKeys(MESSAGES_EN));
    const ru = new Set(collectKeys(MESSAGES_RU));
    const missingInRu = [...en].filter((k) => !ru.has(k));
    const extraInRu = [...ru].filter((k) => !en.has(k));
    expect(missingInRu, 'keys missing in RU').toEqual([]);
    expect(extraInRu, 'extra keys in RU').toEqual([]);
  });

  it('EN and RU have matching shapes per key (string vs function)', () => {
    const errors = compareShapes(MESSAGES_EN, MESSAGES_RU);
    expect(errors).toEqual([]);
  });
});
