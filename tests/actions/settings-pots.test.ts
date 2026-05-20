import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeSettingsActions } from '@/server/actions/settings';
import { getPotBalances } from '@/server/domain/pots';

const SECRET = 'a'.repeat(32);

describe('settings action: updatePotOpenings', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    process.env.SKIP_BOT = '1';
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('updates both openings and reflects in pot balances', async () => {
    const actions = makeSettingsActions({ getDb: () => db });
    const result = await actions.updatePotOpenings({ cashCents: '12.50', cardCents: '7.00' });
    expect(result.cashOpeningCents).toBe(1250);
    expect(result.cardOpeningCents).toBe(700);
    expect(await getPotBalances(db)).toEqual({ cash: 1250, card: 700 });
  });

  it('rejects negative inputs', async () => {
    const actions = makeSettingsActions({ getDb: () => db });
    await expect(actions.updatePotOpenings({ cashCents: '-1', cardCents: '0' })).rejects.toThrow();
  });
});
