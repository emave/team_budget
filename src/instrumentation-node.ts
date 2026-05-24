import { env } from '@/server/env';
import { getBot, registerWebhook, publishAllCommands } from '@/server/bot';
import { scheduleMonthlyDues } from '@/server/jobs/monthly-dues';
import { getDb } from '@/server/db/client';

env();

if (process.env.SKIP_BOT !== '1') {
  const bot = getBot();
  await bot.init();
  await registerWebhook(bot);
  await publishAllCommands(bot);
  console.log('[boot] bot webhook registered, commands published');
} else {
  console.log('[boot] bot skipped (SKIP_BOT=1)');
}

if (process.env.SKIP_CRON !== '1') {
  scheduleMonthlyDues(getDb);
  console.log('[boot] monthly dues cron scheduled');
} else {
  console.log('[boot] cron skipped (SKIP_CRON=1)');
}
