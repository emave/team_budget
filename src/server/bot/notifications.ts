import 'server-only';
import { eq } from 'drizzle-orm';
import { users } from '@/server/db/schema';
import type { Db } from '@/server/domain/types';

export type SendMessage = (chatId: number, text: string) => Promise<void>;

type Recipient = typeof users.$inferSelect;
type TextOrFn = string | ((recipient: Recipient) => string);

export interface Notifier {
  notifyUser(userId: string, text: TextOrFn): Promise<void>;
  notifyAllActive(text: TextOrFn): Promise<void>;
}

function render(text: TextOrFn, recipient: Recipient): string {
  return typeof text === 'function' ? text(recipient) : text;
}

export function makeNotifier(deps: { db: Db; send: SendMessage }): Notifier {
  async function safeSend(chatId: number, text: string) {
    try {
      await deps.send(chatId, text);
    } catch (err) {
      console.error(`[notify] failed to send to chat ${chatId}:`, err);
    }
  }

  return {
    async notifyUser(userId, text) {
      const u = deps.db.select().from(users).where(eq(users.id, userId)).get();
      if (!u) return;
      await safeSend(u.telegramUserId, render(text, u));
    },
    async notifyAllActive(text) {
      const active = deps.db.select().from(users).where(eq(users.isActive, true)).all();
      await Promise.all(active.map((u) => safeSend(u.telegramUserId, render(text, u))));
    },
  };
}

// Production notifier: lazily resolves bot + db to avoid circular imports at module load.
let _prodNotifier: Notifier | null = null;
export function getNotifier(): Notifier {
  if (!_prodNotifier) {
    const { getBot } = require('./index') as typeof import('./index');
    const { getDb } = require('@/server/db/client') as typeof import('@/server/db/client');
    _prodNotifier = makeNotifier({
      db: getDb(),
      send: async (chatId, text) => {
        await getBot().api.sendMessage(chatId, text);
      },
    });
  }
  return _prodNotifier;
}
