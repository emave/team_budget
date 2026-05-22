import { and, eq } from 'drizzle-orm';
import cron from 'node-cron';
import { charges, users } from '@/server/db/schema';
import type { Db } from '@/server/domain/types';
import { currentBillingPeriod, generateMonthlyDues } from '@/server/domain/dues';
import { getCreditBalance } from '@/server/domain/credit';
import { getNotifier } from '../bot/notifications';
import { getOrCreateSettings } from '../domain/settings';
import { formatCents } from '@/shared/format';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';

export interface RunOptions {
  now?: Date;
}

async function pickSystemAdmin(db: Db): Promise<string> {
  const admin = db.select().from(users).where(eq(users.role, 'admin')).get();
  if (!admin) throw new Error('no admin user available to attribute dues to');
  return admin.id;
}

export async function runMonthlyDuesOnce(db: Db, opts: RunOptions = {}) {
  const period = currentBillingPeriod(opts.now);
  const adminId = await pickSystemAdmin(db);
  const result = await generateMonthlyDues(db, { period, createdByUserId: adminId });

  if (result.createdCount > 0 && process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      await getNotifier().notifyAllActive(
        `📅 Monthly dues for ${period} have been added (${formatCents(settings.monthlyDuesAmount)}). Type /balance to see total.`,
      );

      const paidFromWallet = db
        .select({ userId: charges.userId, amount: charges.amount })
        .from(charges)
        .where(
          and(
            eq(charges.type, 'monthly_dues'),
            eq(charges.billingPeriod, period),
            eq(charges.status, 'paid'),
          ),
        )
        .all();
      for (const r of paidFromWallet) {
        const balance = await getCreditBalance(db, r.userId);
        await getNotifier().notifyUser(r.userId, (recipient) => {
          const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
          return getMessages(locale).wallet.notification.autoAppliedDues(
            period,
            formatCents(r.amount),
            formatCents(balance),
          );
        });
      }
    } catch (err) { console.error('[dues] notify failed:', err); }
  }

  return result;
}

let scheduled = false;
export function scheduleMonthlyDues(getDb: () => Db) {
  if (scheduled) return;
  scheduled = true;
  // Every day at 00:05 — idempotent so safe to oversample
  cron.schedule('5 0 * * *', async () => {
    try {
      const db = getDb();
      const r = await runMonthlyDuesOnce(db);
      if (r.createdCount > 0) {
        console.log(`[dues] generated ${r.createdCount} dues for ${r.period}`);
      }
    } catch (err) {
      console.error('[dues] generation failed:', err);
    }
  });
}
