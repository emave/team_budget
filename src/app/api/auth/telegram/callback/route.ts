import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/server/env';
import { verifyTelegramAuth, type TelegramAuthData } from '@/server/auth/telegram';
import { signCookie } from '@/server/auth/session-cookie';
import { getDb } from '@/server/db/client';
import { getUserByTelegramId } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { syncAdminCommandsForUser } from '@/server/bot/admin-commands';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const input: TelegramAuthData = {
    id: Number(sp.get('id')),
    first_name: sp.get('first_name') ?? undefined,
    last_name: sp.get('last_name') ?? undefined,
    username: sp.get('username') ?? undefined,
    photo_url: sp.get('photo_url') ?? undefined,
    auth_date: Number(sp.get('auth_date')),
    hash: sp.get('hash') ?? undefined,
  };

  const e = env();
  const verify = verifyTelegramAuth(input, e.BOT_TOKEN);
  if (!verify.ok) {
    return new NextResponse(`Auth failed: ${verify.reason}`, { status: 401 });
  }

  const db = getDb();
  let user = await getUserByTelegramId(db, input.id);
  if (!user && input.id === e.BOOTSTRAP_ADMIN_TELEGRAM_ID) {
    await bootstrapAdminIfNeeded(db, {
      telegramUserId: input.id,
      displayName:
        [input.first_name, input.last_name].filter(Boolean).join(' ') ||
        input.username ||
        'Admin',
      telegramUsername: input.username ?? null,
      photoUrl: input.photo_url ?? null,
    });
    user = await getUserByTelegramId(db, input.id);
    if (user) await syncAdminCommandsForUser(user);
  }
  if (!user) {
    return new NextResponse(
      'You are not a team member. Ask your admin to send you an invite link via the bot.',
      { status: 403 },
    );
  }

  const session = await createSession(db, user.id);
  const cookieValue = signCookie(session.token, e.SESSION_SECRET);
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set('tb_session', cookieValue, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
  return res;
}
