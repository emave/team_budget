import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('better-sqlite3', () => {
  it('opens an in-memory database', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (x INTEGER)');
    db.prepare('INSERT INTO t VALUES (1)').run();
    const row = db.prepare('SELECT x FROM t').get() as { x: number };
    expect(row.x).toBe(1);
  });
});
