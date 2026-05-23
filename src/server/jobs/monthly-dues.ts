import { and, eq } from 'drizzle-orm';
import cron from 'node-cron';
import type { Charge } from '@/server/domain/charges';
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

export async function notifyDuesCreated(db: Db, charge: Charge): Promise<void> {
  if (process.env.SKIP_BOT === '1') return;
  if (charge.status === 'paid') {
    const balance = await getCreditBalance(db, charge.userId);
    await getNotifier().notifyUser(charge.userId, (recipient) => {
      const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
      return getMessages(locale).wallet.notification.autoAppliedDues(
        charge.billingPeriod ?? '',
        formatCents(charge.amount),
        formatCents(balance),
      );
    });
    return;
  }
  await getNotifier().notifyUser(charge.userId, (recipient) => {
    const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
    return getMessages(locale).wallet.notification.duesCreated(
      charge.billingPeriod ?? '',
      formatCents(charge.amount),
    );
  });
}

export async function runMonthlyDuesOnce(db: Db, opts: RunOptions = {}) {
  const period = currentBillingPeriod(opts.now);
  const adminId = await pickSystemAdmin(db);
  const result = await generateMonthlyDues(db, { period, createdByUserId: adminId });

  if (result.createdCount > 0 && process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      await getNotifier().notifyAllActive((recipient) => {
        const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
        return getMessages(locale).wallet.notification.duesCreated(
          period,
          formatCents(settings.monthlyDuesAmount),
        );
      });

      const paidFromWallet = db
        .select()
        .from(charges)
        .where(
          and(
            eq(charges.type, 'monthly_dues'),
            eq(charges.billingPeriod, period),
            eq(charges.status, 'paid'),
          ),
        )
        .all();
      for (const c of paidFromWallet) {
        await notifyDuesCreated(db, c);
      }
    } catch (err) { console.error('[dues] notify failed:', err); }
  }

  return result;
}

let scheduled = false;
export function scheduleMonthlyDues(getDb: () => Db) {
  if (scheduled) return;
  scheduled = true;
  // 00:05 on the 1st of each month — generates dues for the new billing period
  cron.schedule('5 0 1 * *', async () => {
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
