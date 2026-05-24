import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerHistoryHandler } from '@/server/bot/handlers/history';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
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
  registerHistoryHandler(bot);
  return { bot, replies };
}

function update(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X', language_code: 'en' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/history',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 8 }],
    },
  };
}

describe('/history', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows empty history for a fresh member', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/no recent activity/i);
  });

  it('lists charges + payments for the user', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const c = await createAdhocCharge(db, { userId: m.id, amount: 1000, description: 'gear', createdByUserId: admin.id });
    await recordPayment(db, {
      payerUserId: m.id, method: 'cash', amount: 1000,
      allocations: [{ chargeId: c.id, amount: 1000 }],
      createdByUserId: admin.id,
    });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    const out = replies.join('\n');
    expect(out).toMatch(/gear/);
    expect(out).toMatch(/cash/);
  });

  it('includes credit deposits in unified history', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { recordCreditDeposit } = await import('@/server/domain/credit');
    await recordCreditDeposit(db, { payerUserId: m.id, amount: 2000, method: 'cash', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/deposited.*20\.00/i);
  });

  it('does not double-count payment_consumption alongside the charge', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { recordCreditDeposit, applyCreditToCharge } = await import('@/server/domain/credit');
    await recordCreditDeposit(db, { payerUserId: m.id, amount: 5000, method: 'cash', createdByUserId: admin.id });
    const charge = await createAdhocCharge(db, { userId: m.id, amount: 1000, description: 'gear', createdByUserId: admin.id });
    await applyCreditToCharge(db, { chargeId: charge.id, amount: 1000 });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    const out = replies.join('\n');
    expect(out).toMatch(/gear/);
    expect(out).not.toMatch(/applied.*gear/i);
  });
});
