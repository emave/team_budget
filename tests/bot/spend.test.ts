import { describe, it, expect } from 'vitest';
import { spendConversation } from '@/server/bot/conversations/spend';

describe('spend conversation', () => {
  it('module loads and exports a function', () => {
    expect(typeof spendConversation).toBe('function');
  });
});
