import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';

function makeUpdate(fromId: number, text: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text,
    },
  };
}

describe('identifyUser middleware', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('attaches a known user to ctx', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const bot = new Bot<BotContext>('123:abc', {
      botInfo: { id: 123, is_bot: true, first_name: 'TestBot', username: 'test_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false },
    });
    bot.use((ctx, next) => {
      ctx.db = db;
      return next();
    });
    bot.use(identifyUser);
    let captured: BotContext['currentUser'] = null;
    bot.on('message', (ctx) => {
      captured = ctx.currentUser;
    });
    await bot.handleUpdate(makeUpdate(42, '/anything'));
    expect(captured?.id).toBe(u.id);
  });

  it('leaves currentUser null for unknown sender', async () => {
    const bot = new Bot<BotContext>('123:abc', {
      botInfo: { id: 123, is_bot: true, first_name: 'TestBot', username: 'test_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false },
    });
    bot.use((ctx, next) => {
      ctx.db = db;
      return next();
    });
    bot.use(identifyUser);
    let captured: BotContext['currentUser'] = undefined as never;
    bot.on('message', (ctx) => {
      captured = ctx.currentUser;
    });
    await bot.handleUpdate(makeUpdate(999, '/anything'));
    expect(captured).toBeNull();
  });
});
