import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerHelpHandler } from '@/server/bot/handlers/help';
import { registerMenuHandler } from '@/server/bot/handlers/menu';

function setup(db: TestDb) {
  process.env.BOT_TOKEN = 'test:0123456789';
  process.env.BOT_USERNAME = 'test_bot';
  process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'a'.repeat(32);

  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: 'TestBot',
      username: 'test_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    },
  });
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
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });
  bot.use(identifyUser);
  registerHelpHandler(bot);
  registerMenuHandler(bot);
  return { bot, replies };
}

function helpUpdate(fromId: number, cmd: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: `/${cmd}`,
      entities: [{ type: 'bot_command' as const, offset: 0, length: cmd.length + 1 }],
    },
  };
}

describe('/help and /menu', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('shows help text to anyone', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(999, 'help'));
    expect(replies.join('\n')).toMatch(/balance.*history.*info/is);
  });

  it('rejects /menu for unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(999, 'menu'));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows menu for member', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(5, 'menu'));
    expect(replies.join('\n')).toMatch(/Main menu/i);
  });
});
