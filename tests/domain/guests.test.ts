import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createGuest,
  listGuests,
  getGuest,
  renameGuest,
  archiveGuest,
  unarchiveGuest,
} from '@/server/domain/guests';

describe('guests domain', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
  });

  it('creates a guest with trimmed name', async () => {
    const g = await createGuest(db, { name: '  Pasha  ', createdByUserId: adminId });
    expect(g.name).toBe('Pasha');
    expect(g.archived).toBe(false);
  });

  it('rejects empty name', async () => {
    await expect(createGuest(db, { name: '   ', createdByUserId: adminId })).rejects.toThrow();
  });

  it('lists non-archived guests by default', async () => {
    const a = await createGuest(db, { name: 'A', createdByUserId: adminId });
    const b = await createGuest(db, { name: 'B', createdByUserId: adminId });
    await archiveGuest(db, b.id);
    const visible = await listGuests(db);
    expect(visible.map((g) => g.id)).toEqual([a.id]);
    const all = await listGuests(db, { includeArchived: true });
    expect(all.length).toBe(2);
  });

  it('renames a guest', async () => {
    const g = await createGuest(db, { name: 'A', createdByUserId: adminId });
    const renamed = await renameGuest(db, g.id, '  B  ');
    expect(renamed.name).toBe('B');
    expect((await getGuest(db, g.id))!.name).toBe('B');
  });

  it('archive and unarchive are idempotent', async () => {
    const g = await createGuest(db, { name: 'A', createdByUserId: adminId });
    await archiveGuest(db, g.id);
    await archiveGuest(db, g.id);
    expect((await getGuest(db, g.id))!.archived).toBe(true);
    await unarchiveGuest(db, g.id);
    await unarchiveGuest(db, g.id);
    expect((await getGuest(db, g.id))!.archived).toBe(false);
  });
});
