import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  createCategory,
  listCategories,
  archiveCategory,
  renameCategory,
} from '@/server/domain/categories';

describe('categories', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a category', async () => {
    const c = await createCategory(db, 'Ammo');
    expect(c.name).toBe('Ammo');
    expect(c.archived).toBe(false);
  });

  it('lists active categories', async () => {
    await createCategory(db, 'Ammo');
    await createCategory(db, 'Range');
    expect((await listCategories(db)).map((c) => c.name)).toEqual(['Ammo', 'Range']);
  });

  it('archives a category', async () => {
    const c = await createCategory(db, 'Ammo');
    await archiveCategory(db, c.id);
    expect(await listCategories(db)).toEqual([]);
    expect((await listCategories(db, { includeArchived: true })).length).toBe(1);
  });

  it('renames a category', async () => {
    const c = await createCategory(db, 'Ammo');
    const r = await renameCategory(db, c.id, 'Ammunition');
    expect(r.name).toBe('Ammunition');
  });

  it('rejects empty name', async () => {
    await expect(createCategory(db, '')).rejects.toThrow();
  });
});
