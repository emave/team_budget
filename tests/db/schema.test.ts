import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers/db';
import { users } from '@/server/db/schema';

describe('schema (in-memory)', () => {
  it('migrates and accepts a user insert', () => {
    const db = createTestDb();
    db.insert(users).values({
      id: 'u-1',
      telegramUserId: 100,
      displayName: 'Alice',
      role: 'admin',
    }).run();

    const rows = db.select().from(users).all();
    expect(rows.length).toBe(1);
    expect(rows[0]?.role).toBe('admin');
  });
});
