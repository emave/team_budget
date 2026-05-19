import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createInfoPage,
  updateInfoPage,
  listInfoPages,
  reorderInfoPages,
  deleteInfoPage,
} from '@/server/domain/info-pages';

describe('info pages', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
  });

  it('creates and lists in sortOrder', async () => {
    const a = await createInfoPage(db, {
      title: 'Card details',
      body: '...',
      updatedByUserId: adminId,
    });
    const b = await createInfoPage(db, {
      title: 'How to pay',
      body: '...',
      updatedByUserId: adminId,
    });
    const list = await listInfoPages(db);
    expect(list.map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('updates title and body', async () => {
    const p = await createInfoPage(db, {
      title: 'Old',
      body: 'x',
      updatedByUserId: adminId,
    });
    const updated = await updateInfoPage(db, p.id, {
      title: 'New',
      body: 'y',
      updatedByUserId: adminId,
    });
    expect(updated.title).toBe('New');
    expect(updated.body).toBe('y');
  });

  it('reorders pages', async () => {
    const a = await createInfoPage(db, {
      title: 'A',
      body: '',
      updatedByUserId: adminId,
    });
    const b = await createInfoPage(db, {
      title: 'B',
      body: '',
      updatedByUserId: adminId,
    });
    const c = await createInfoPage(db, {
      title: 'C',
      body: '',
      updatedByUserId: adminId,
    });
    await reorderInfoPages(db, [c.id, a.id, b.id]);
    const list = await listInfoPages(db);
    expect(list.map((p) => p.id)).toEqual([c.id, a.id, b.id]);
  });

  it('deletes a page', async () => {
    const p = await createInfoPage(db, {
      title: 'X',
      body: '',
      updatedByUserId: adminId,
    });
    await deleteInfoPage(db, p.id);
    expect((await listInfoPages(db)).length).toBe(0);
  });
});
