import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2 } from '@/server/bot/markdown';

describe('escapeMarkdownV2', () => {
  it('escapes all reserved characters', () => {
    expect(escapeMarkdownV2('a_b*c[d]')).toBe('a\\_b\\*c\\[d\\]');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeMarkdownV2('hello world')).toBe('hello world');
  });

  it('escapes parens and dot', () => {
    expect(escapeMarkdownV2('see (note.).')).toBe('see \\(note\\.\\)\\.');
  });
});
