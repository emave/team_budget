import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
  if (!_db) {
    const url = process.env.DATABASE_URL ?? 'data/team_budget.db';
    const sqlite = new Database(url);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
