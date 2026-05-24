import { getBot } from '@/server/bot';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = env().TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers.get('x-telegram-bot-api-secret-token');
  if (!secret || !provided || provided !== secret) {
    return new Response('forbidden', { status: 401 });
  }
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  try {
    const bot = getBot();
    await bot.init();
    await bot.handleUpdate(
      update as Parameters<typeof bot.handleUpdate>[0],
    );
  } catch (err) {
    console.error('[bot] handleUpdate failed:', err);
  }
  return new Response('ok', { status: 200 });
}
