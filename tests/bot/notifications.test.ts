import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, deactivateUser } from '@/server/domain/users';
import { makeNotifier, type SendMessage } from '@/server/bot/notifications';

describe('notifier', () => {
  let db: TestDb;
  let sent: { chatId: number; text: string }[];
  let send: SendMessage;

  beforeEach(() => {
    db = createTestDb();
    sent = [];
    send = async (chatId, text) => { sent.push({ chatId, text }); };
  });

  it('notifyUser sends to the user telegram id', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'Alice', role: 'member' });
    const notifier = makeNotifier({ db, send });
    await notifier.notifyUser(u.id, 'Hello');
    expect(sent).toEqual([{ chatId: 42, text: 'Hello' }]);
  });

  it('notifyUser is a no-op for unknown user', async () => {
    const notifier = makeNotifier({ db, send });
    await notifier.notifyUser('ghost-id', 'Hello');
    expect(sent).toEqual([]);
  });

  it('notifyAllActive sends to every active user', async () => {
    await createUser(db, { telegramUserId: 10, displayName: 'A', role: 'admin' });
    await createUser(db, { telegramUserId: 20, displayName: 'B', role: 'member' });
    const inactive = await createUser(db, { telegramUserId: 30, displayName: 'C', role: 'member' });
    await deactivateUser(db, inactive.id);

    const notifier = makeNotifier({ db, send });
    await notifier.notifyAllActive('Heads up');
    expect(sent.map((s) => s.chatId).sort()).toEqual([10, 20]);
  });

  it('swallows send errors and does not throw', async () => {
    const failing: SendMessage = async () => { throw new Error('telegram is angry'); };
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'admin' });
    const notifier = makeNotifier({ db, send: failing });
    await notifier.notifyUser(u.id, 'x');
  });
});
