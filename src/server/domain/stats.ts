import { and, count, eq, gt, isNull, sum } from 'drizzle-orm';
import { charges, invites, sessions, users } from '@/server/db/schema';
import type { Db } from './types';
import { getPotBalances } from './pots';
import { getOrCreateSettings } from './settings';
import { recentActivity, type ActivityEvent } from './activity';
import pkg from '../../../package.json';

const APP_STARTED_AT = Date.now();

function formatUptime(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export interface Stats {
  version: { package: string; gitSha: string; buildTime: string };
  uptime: { seconds: number; human: string };
  money: {
    currency: string;
    cashCents: number;
    cardCents: number;
    monthlyDuesCents: number;
    openDuesCents: number;
  };
  members: { active: number; total: number };
  requests: {
    openCharges: { count: number; totalCents: number };
    pendingInvites: { count: number };
    activeSessions: { count: number };
  };
  recent: ActivityEvent[];
}

export async function getStats(db: Db): Promise<Stats> {
  const [pots, settings] = await Promise.all([
    getPotBalances(db),
    getOrCreateSettings(db),
  ]);

  const openChargesRow = db
    .select({ c: count(), s: sum(charges.amount) })
    .from(charges)
    .where(eq(charges.status, 'open'))
    .get();
  const openCount = Number(openChargesRow?.c ?? 0);
  const openTotal = Number(openChargesRow?.s ?? 0);

  const pendingInvitesRow = db
    .select({ c: count() })
    .from(invites)
    .where(isNull(invites.consumedByUserId))
    .get();

  const activeSessionsRow = db
    .select({ c: count() })
    .from(sessions)
    .where(gt(sessions.expiresAt, new Date().toISOString()))
    .get();

  const activeMembersRow = db
    .select({ c: count() })
    .from(users)
    .where(eq(users.isActive, true))
    .get();
  const totalMembersRow = db.select({ c: count() }).from(users).get();

  const recent = await recentActivity(db, 12);

  const uptimeSeconds = (Date.now() - APP_STARTED_AT) / 1000;

  return {
    version: {
      package: pkg.version,
      gitSha: process.env.GIT_SHA || 'unknown',
      buildTime: process.env.BUILD_TIME || 'unknown',
    },
    uptime: { seconds: uptimeSeconds, human: formatUptime(uptimeSeconds) },
    money: {
      currency: 'BYN',
      cashCents: pots.cash,
      cardCents: pots.card,
      monthlyDuesCents: settings.monthlyDuesAmount,
      openDuesCents: openTotal,
    },
    members: {
      active: Number(activeMembersRow?.c ?? 0),
      total: Number(totalMembersRow?.c ?? 0),
    },
    requests: {
      openCharges: { count: openCount, totalCents: openTotal },
      pendingInvites: { count: Number(pendingInvitesRow?.c ?? 0) },
      activeSessions: { count: Number(activeSessionsRow?.c ?? 0) },
    },
    recent,
  };
}
