import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

// Smart quick-search `@` trigger (docs/smart-quick-search-plan-2026-09-27.md, Part 2) -
// the current employee's own free-text search history, server-side only (shared/kiosk
// workstations mean a localStorage-only history would mix employees together). Always
// scoped to the employeeId derived from the auth_token cookie server-side - never a
// client-supplied employee id, same as app/api/me/design-prefs/route.js.
const HISTORY_LIMIT = 20;

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const employeeId = cookieStore.get('auth_token')?.value || null;
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Over-fetch a bit before de-duping by query text, so 20 *distinct* recent
    // queries still come back even when the same query was searched repeatedly.
    const rows = await prisma.searchHistory.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT * 4,
    });

    const seen = new Set();
    const deduped = [];
    for (const row of rows) {
      if (seen.has(row.query)) continue;
      seen.add(row.query);
      deduped.push(row);
      if (deduped.length >= HISTORY_LIMIT) break;
    }

    return NextResponse.json({ history: deduped });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json({ error: 'Failed to fetch search history' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const employeeId = cookieStore.get('auth_token')?.value || null;
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const domain = typeof body?.domain === 'string' && body.domain.trim() ? body.domain.trim() : null;

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const created = await prisma.searchHistory.create({
      data: { employeeId, query, domain },
    });

    // Trim this employee's history down to the most recent HISTORY_LIMIT rows -
    // find the id to keep down to, then delete anything older than it.
    const keep = await prisma.searchHistory.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true },
    });
    const keepIds = keep.map((r) => r.id);
    await prisma.searchHistory.deleteMany({
      where: { employeeId, id: { notIn: keepIds } },
    });

    return NextResponse.json({ success: true, entry: created });
  } catch (error) {
    console.error('Error recording search history:', error);
    return NextResponse.json({ error: 'Failed to record search history' }, { status: 500 });
  }
}
