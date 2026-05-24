import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createInvite } from '@/server/domain/invites';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerStartHandler } from '@/server/bot/handlers/start';

function makeStart(fromId: number, payload?: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'Vasya', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'Vasya' },
      text: payload ? `/start ${payload}` : '/start',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  };
}

function makeBot(db: TestDb, opts: { bootstrapAdminId?: number } = {}) {
  const replies: string[] = [];
  // Use the same pattern D2's test established — include minimal botInfo so handleUpdate works
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
  registerStartHandler(bot, { bootstrapAdminTelegramId: opts.bootstrapAdminId ?? -1 });
  return { bot, replies };
}

describe('/start', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Owner',
      role: 'admin',
    });
    adminId = a.id;
  });

  it('greets an existing user', async () => {
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(1));
    expect(replies.join('\n')).toMatch(/welcome back/i);
  });

  it('consumes an invite for unknown user and creates the member', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'Vasya' });
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(99, `invite_${inv.token}`));
    expect(replies.join('\n')).toMatch(/welcome to the team/i);

    const { getUserByTelegramId } = await import('@/server/domain/users');
    const u = await getUserByTelegramId(db, 99);
    expect(u?.role).toBe('member');
  });

  it('rejects unknown user without invite', async () => {
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(99));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('bootstraps admin when telegram id matches', async () => {
    const db2 = createTestDb();
    const { bot, replies } = makeBot(db2, { bootstrapAdminId: 555 });
    await bot.handleUpdate(makeStart(555));
    expect(replies.join('\n')).toMatch(/welcome, admin/i);
    const { getUserByTelegramId } = await import('@/server/domain/users');
    const u = await getUserByTelegramId(db2, 555);
    expect(u?.role).toBe('admin');
  });

  it('does not bootstrap if an admin already exists', async () => {
    const { bot, replies } = makeBot(db, { bootstrapAdminId: 555 });
    await bot.handleUpdate(makeStart(555));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });
});
