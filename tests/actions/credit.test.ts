import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { makeCreditActions } from '@/server/actions/credit';

describe('makeCreditActions wiring', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    process.env.SESSION_SECRET ??= 'test-secret';
  });
  it('exposes the credit action set', () => {
    const actions = makeCreditActions({ getDb: () => db });
    expect(typeof actions.recordCreditDeposit).toBe('function');
    expect(typeof actions.applyCreditToCharge).toBe('function');
    expect(typeof actions.refundCredit).toBe('function');
    expect(typeof actions.transferCredit).toBe('function');
    expect(typeof actions.cancelCreditMovement).toBe('function');
    expect(typeof actions.getCreditBalance).toBe('function');
    expect(typeof actions.listCreditHistory).toBe('function');
    expect(adminId).toBeTruthy();
  });
});
