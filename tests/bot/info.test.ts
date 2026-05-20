import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createInfoPage } from '@/server/domain/info-pages';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerInfoHandler } from '@/server/bot/handlers/info';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage' || method === 'editMessageText') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: true } as never);
    }
    if (method === 'answerCallbackQuery') {
      return Promise.resolve({ ok: true, result: true } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerInfoHandler(bot);
  return { bot, replies };
}

function infoUpdate(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/info',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 5 }],
    },
  };
}

describe('/info', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows no-entries message when empty', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(5));
    expect(replies.join('\n')).toMatch(/no info entries/i);
  });

  it('lists info pages by title', async () => {
    const a = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    await createInfoPage(db, { title: 'Card details', body: 'Send to 1234', updatedByUserId: a.id });
    await createInfoPage(db, { title: 'How to pay', body: 'Use /pay', updatedByUserId: a.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(5));
    const out = replies.join('\n');
    expect(out).toMatch(/tap/i);
  });
});
