import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, users } from '@/server/db/schema';
import type { Db } from './types';
import type { Charge } from './charges';
import { consumeCreditForCharge } from './credit';
import { getOrCreateSettings, setLastDuesGeneratedFor } from './settings';

export interface GenerateDuesInput {
  period: string; // YYYY-MM
  createdByUserId: string;
}

export interface GenerateDuesResult {
  createdCount: number;
  period: string;
}

export async function generateMonthlyDues(
  db: Db,
  input: GenerateDuesInput,
): Promise<GenerateDuesResult> {
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error(`invalid period: ${input.period}`);
  }
  const s = await getOrCreateSettings(db);
  if (s.lastDuesGeneratedFor === input.period) {
    return { createdCount: 0, period: input.period };
  }
  if (s.monthlyDuesAmount <= 0) {
    throw new Error('monthly_dues_amount must be set to a positive value before generating');
  }

  const existing = db
    .select({ userId: charges.userId })
    .from(charges)
    .where(and(eq(charges.type, 'monthly_dues'), eq(charges.billingPeriod, input.period)))
    .all();
  const have = new Set(existing.map((r) => r.userId));

  const active = db.select().from(users).where(eq(users.isActive, true)).all();

  let created = 0;
  const createdIds: string[] = [];
  db.transaction((tx) => {
    for (const u of active) {
      if (have.has(u.id)) continue;
      const id = randomUUID();
      tx.insert(charges)
        .values({
          id,
          userId: u.id,
          type: 'monthly_dues',
          amount: s.monthlyDuesAmount,
          description: `Monthly dues — ${input.period}`,
          billingPeriod: input.period,
          status: 'open',
          createdByUserId: input.createdByUserId,
        })
        .run();
      createdIds.push(id);
      created += 1;
    }
  });

  const { consumeCreditForCharge } = await import('./credit');
  for (const id of createdIds) {
    await consumeCreditForCharge(db, id);
  }

  await setLastDuesGeneratedFor(db, input.period);
  return { createdCount: created, period: input.period };
}

export function currentBillingPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export class MemberAlreadyChargedError extends Error {
  constructor(public readonly existingCharge: Charge) {
    super(`member already has monthly_dues charge for ${existingCharge.billingPeriod}`);
    this.name = 'MemberAlreadyChargedError';
  }
}

export interface ChargeMemberDuesInput {
  userId: string;
  period: string;
  createdByUserId: string;
}

export async function chargeMemberDues(
  db: Db,
  input: ChargeMemberDuesInput,
): Promise<Charge> {
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error(`invalid period: ${input.period}`);
  }
  const s = await getOrCreateSettings(db);
  if (s.monthlyDuesAmount <= 0) {
    throw new Error('monthly_dues_amount must be set to a positive value before generating');
  }

  const user = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!user) throw new Error(`user ${input.userId} not found`);
  if (!user.isActive) throw new Error(`user ${input.userId} is not active`);

  const existing = db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.userId, input.userId),
        eq(charges.type, 'monthly_dues'),
        eq(charges.billingPeriod, input.period),
      ),
    )
    .get();
  if (existing) throw new MemberAlreadyChargedError(existing);

  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'monthly_dues',
      amount: s.monthlyDuesAmount,
      description: `Monthly dues — ${input.period}`,
      billingPeriod: input.period,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();

  await consumeCreditForCharge(db, id);

  const c = db.select().from(charges).where(eq(charges.id, id)).get();
  if (!c) throw new Error(`failed to read back charge ${id}`);
  return c;
}
