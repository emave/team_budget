import { describe, it, expect } from 'vitest';
import { infoEditConversation } from '@/server/bot/conversations/info-edit';

describe('info_edit conversation', () => {
  it('module loads', () => {
    expect(typeof infoEditConversation).toBe('function');
  });
});
