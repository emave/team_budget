import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, getUserByTelegramId } from '@/server/domain/users';
import { seedLocaleIfMissing } from '@/server/auth/seed-locale';

describe('seedLocaleIfMissing', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('writes ru when user has no locale and language_code is "ru"', async () => {
    const u = await createUser(db, {
      telegramUserId: 1,
      displayName: 'A',
      role: 'member',
      locale: null,
    });
    const next = await seedLocaleIfMissing(db, u, 'ru');
    expect(next.locale).toBe('ru');
    const reread = await getUserByTelegramId(db, 1);
    expect(reread?.locale).toBe('ru');
  });

  it('writes en when language_code is "en-US"', async () => {
    const u = await createUser(db, {
      telegramUserId: 2,
      displayName: 'B',
      role: 'member',
      locale: null,
    });
    const next = await seedLocaleIfMissing(db, u, 'en-US');
    expect(next.locale).toBe('en');
  });

  it('does not overwrite an existing locale', async () => {
    const u = await createUser(db, {
      telegramUserId: 3,
      displayName: 'C',
      role: 'member',
      locale: 'en',
    });
    const next = await seedLocaleIfMissing(db, u, 'ru');
    expect(next.locale).toBe('en');
  });

  it('falls back to default when language_code is missing or unknown', async () => {
    const u = await createUser(db, {
      telegramUserId: 4,
      displayName: 'D',
      role: 'member',
      locale: null,
    });
    const next = await seedLocaleIfMissing(db, u, undefined);
    expect(next.locale).toBeNull();
    const next2 = await seedLocaleIfMissing(db, u, 'zh');
    expect(next2.locale).toBeNull();
  });
});
