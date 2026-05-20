import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/server/env';
import { verifyMiniAppInitData } from '@/server/auth/telegram';
import { signCookie } from '@/server/auth/session-cookie';
import { getDb } from '@/server/db/client';
import { getUserByTelegramId } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { syncAdminCommandsForUser } from '@/server/bot/admin-commands';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const initData = body && typeof body.initData === 'string' ? body.initData : '';
  if (!initData) {
    return new NextResponse('missing initData', { status: 400 });
  }

  const e = env();
  const verify = verifyMiniAppInitData(initData, e.BOT_TOKEN);
  if (!verify.ok) {
    return new NextResponse(`Auth failed: ${verify.reason}`, { status: 401 });
  }

  const db = getDb();
  let user = await getUserByTelegramId(db, verify.user.id);
  if (!user && verify.user.id === e.BOOTSTRAP_ADMIN_TELEGRAM_ID) {
    await bootstrapAdminIfNeeded(db, {
      telegramUserId: verify.user.id,
      displayName:
        [verify.user.first_name, verify.user.last_name].filter(Boolean).join(' ') ||
        verify.user.username ||
        'Admin',
      telegramUsername: verify.user.username ?? null,
      photoUrl: verify.user.photo_url ?? null,
    });
    user = await getUserByTelegramId(db, verify.user.id);
    if (user) await syncAdminCommandsForUser(user);
  }
  if (!user) {
    return new NextResponse('Not a team member', { status: 403 });
  }

  const session = await createSession(db, user.id);
  const cookieValue = signCookie(session.token, e.SESSION_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tb_session', cookieValue, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
  return res;
}
