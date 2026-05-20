import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { getStats } from '@/server/domain/stats';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const e = env();
  if (!e.STATS_TOKEN) {
    return new NextResponse('stats endpoint disabled (set STATS_TOKEN)', { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (presented !== e.STATS_TOKEN) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const stats = await getStats(getDb());
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
