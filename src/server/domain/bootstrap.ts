import { eq } from 'drizzle-orm';
import { users } from '@/server/db/schema';
import type { Db } from './types';
import { createUser, getUserByTelegramId } from './users';

export interface BootstrapInput {
  telegramUserId: number;
  displayName: string;
  telegramUsername?: string | null;
  photoUrl?: string | null;
}

export async function bootstrapAdminIfNeeded(
  db: Db,
  input: BootstrapInput,
): Promise<{ created: boolean }> {
  const existingAdmin = db.select().from(users).where(eq(users.role, 'admin')).get();
  if (existingAdmin) return { created: false };

  const existingUser = await getUserByTelegramId(db, input.telegramUserId);
  if (existingUser) return { created: false };

  await createUser(db, {
    telegramUserId: input.telegramUserId,
    displayName: input.displayName,
    telegramUsername: input.telegramUsername ?? null,
    photoUrl: input.photoUrl ?? null,
    role: 'admin',
  });
  return { created: true };
}
