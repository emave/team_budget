import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/telegram/callback',
  '/api/auth/telegram/mini',
  '/api/bot/webhook',
  '/api/stats',
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname === '/mini' || pathname.startsWith('/mini/')) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  const cookie = req.cookies.get('tb_session');
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
