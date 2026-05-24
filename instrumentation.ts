let registered: Promise<void> | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (registered) return registered;
  registered = (async () => {
    const { env } = await import('@/server/env');
    env();

    if (process.env.SKIP_BOT !== '1') {
      const { getBot, registerWebhook, publishAllCommands } = await import('@/server/bot');
      const bot = getBot();
      await registerWebhook(bot);
      await publishAllCommands(bot);
      console.log('[boot] bot webhook registered, commands published');
    } else {
      console.log('[boot] bot skipped (SKIP_BOT=1)');
    }

    if (process.env.SKIP_CRON !== '1') {
      const { scheduleMonthlyDues } = await import('@/server/jobs/monthly-dues');
      const { getDb } = await import('@/server/db/client');
      scheduleMonthlyDues(getDb);
      console.log('[boot] monthly dues cron scheduled');
    } else {
      console.log('[boot] cron skipped (SKIP_CRON=1)');
    }
  })();
  return registered;
}
