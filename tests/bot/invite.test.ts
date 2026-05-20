import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerInviteHandler } from '@/server/bot/handlers/invite';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  process.env.BOT_TOKEN = 'test:0123456789';
  process.env.BOT_USERNAME = 'test_bot';
  process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'a'.repeat(32);

  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' } } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerInviteHandler(bot);
  return { bot, replies };
}

function update(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/invite',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 7 }],
    },
  };
}

describe('/invite', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('admin only', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/admins only/i);
  });

  it('admin gets a link', async () => {
    await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(1));
    expect(replies.join('\n')).toMatch(/t\.me\/test_bot\?start=invite_/);
  });
});
