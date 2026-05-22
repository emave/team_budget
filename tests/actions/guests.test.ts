import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { makeGuestActions } from '@/server/actions/guests';

describe('makeGuestActions wiring', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    process.env.SESSION_SECRET ??= 'test-secret';
  });
  it('exposes createGuest, listGuests, etc.', () => {
    const actions = makeGuestActions({ getDb: () => db });
    expect(typeof actions.createGuest).toBe('function');
    expect(typeof actions.listGuests).toBe('function');
    expect(typeof actions.renameGuest).toBe('function');
    expect(typeof actions.archiveGuest).toBe('function');
    expect(typeof actions.unarchiveGuest).toBe('function');
    expect(adminId).toBeTruthy();
  });
});
