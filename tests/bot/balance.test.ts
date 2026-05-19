import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerBalanceHandler } from '@/server/bot/handlers/balance';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'Test', username: 'test_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({
        ok: true,
        result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' },
      } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerBalanceHandler(bot);
  return { bot, replies };
}

function balanceUpdate(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/balance',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 8 }],
    },
  };
}

describe('/balance', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows zero balance when no debt', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    expect(replies.join('\n')).toMatch(/settled/i);
  });

  it('lists open charges with total', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    await createAdhocCharge(db, { userId: m.id, amount: 5000, description: 'gear', createdByUserId: admin.id });
    await createAdhocCharge(db, { userId: m.id, amount: 3000, description: 'misc', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    const out = replies.join('\n');
    expect(out).toMatch(/80\.00/);
    expect(out).toMatch(/gear/);
    expect(out).toMatch(/misc/);
  });
});
