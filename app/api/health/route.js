import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// Health endpoint for manual/external checks ("is the DB up?"). It used to also be hit by a
// daily Vercel cron as a Neon keep-alive - that cron was removed 2026-09-20 (keep-alive was
// retired 2026-09-01 so Neon may sleep; the ping only woke the compute for nothing).
// Intentionally does NOT go through checkAuth() — a single tiny round-trip (`SELECT 1`) and
// nothing else. Reads are not audit-logged by the prisma extension, so this writes nothing.
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
