import type { Db } from './types';
import { listActiveMembers } from './users';
import { getMemberOutstandingDebt } from './charges';
import { getPotBalances } from './pots';

export interface MemberBalance {
  userId: string;
  displayName: string;
  outstandingCents: number;
}

export interface TeamOverview {
  totalOutstandingCents: number;
  cashPotCents: number;
  cardPotCents: number;
  members: MemberBalance[];
  settledCount: number;
  unsettledCount: number;
}

export async function getTeamOverview(db: Db): Promise<TeamOverview> {
  const [activeMembers, pots] = await Promise.all([
    listActiveMembers(db),
    getPotBalances(db),
  ]);

  const balances = await Promise.all(
    activeMembers.map(async (u) => ({
      userId: u.id,
      displayName: u.displayName,
      outstandingCents: await getMemberOutstandingDebt(db, u.id),
    })),
  );

  balances.sort((a, b) => b.outstandingCents - a.outstandingCents);

  const totalOutstandingCents = balances.reduce((s, b) => s + b.outstandingCents, 0);
  const unsettledCount = balances.filter((b) => b.outstandingCents > 0).length;
  const settledCount = balances.length - unsettledCount;

  return {
    totalOutstandingCents,
    cashPotCents: pots.cash,
    cardPotCents: pots.card,
    members: balances,
    settledCount,
    unsettledCount,
  };
}
