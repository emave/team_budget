import type { drizzle } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@/server/db/schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;
