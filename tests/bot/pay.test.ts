import { describe, it, expect } from 'vitest';
import { payConversation } from '@/server/bot/conversations/pay';

describe('pay conversation', () => {
  it('module loads', () => {
    expect(typeof payConversation).toBe('function');
  });
});
