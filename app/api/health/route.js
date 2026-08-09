import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// Keep-alive / health endpoint, hit by the Vercel cron in vercel.json (and
// usable by any external pinger) to stop Neon's compute from autosuspending
// during working hours. Intentionally does NOT go through checkAuth() — the
// whole point is a single tiny round-trip (`SELECT 1`) and nothing else.
// Reads are not audit-logged by the prisma extension, so this writes nothing.
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'up', ms: Date.now() - startedAt });
  } catch (error) {
    console.error('Health check DB error:', error?.message || error);
    return NextResponse.json(
      { ok: false, db: 'down', ms: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
