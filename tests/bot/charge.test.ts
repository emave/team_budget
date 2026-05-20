import { describe, it, expect } from 'vitest';
import { chargeConversation } from '@/server/bot/conversations/charge';

describe('charge conversation', () => {
  it('module loads', () => {
    expect(typeof chargeConversation).toBe('function');
  });
});
