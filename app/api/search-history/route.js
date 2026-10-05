import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { isMissingTableError } from '@/lib/prismaMissingTable';

// Smart quick-search `@` trigger (docs/smart-quick-search-plan-2026-09-27.md, Part 2) -
// the current employee's own free-text search history, server-side only (shared/kiosk
// workstations mean a localStorage-only history would mix employees together). Always
// scoped to the employeeId derived from the auth_token cookie server-side - never a
// client-supplied employee id, same as app/api/me/design-prefs/route.js.
const HISTORY_LIMIT = 20;
const QUERY_MAX_LENGTH = 300;
const DOMAIN_MAX_LENGTH = 40;

// VERIFIED auth_token only (signed auth_session naming the same employee) - never the raw
// cookie, see CLAUDE.md "Auth cookie forgery". checkAuth() passes anonymous requests while
// require_login is off, so a raw read would let a hand-typed auth_token (any employee id from
// the public login picker) read and write that employee's history.
async function getEmployeeId() {
  const cookieStore = await cookies();
  return getVerifiedAuthCookie(cookieStore)?.value || null;
}

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const employeeId = await getEmployeeId();
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
    // SearchHistory table not created in this database yet (no DDL from here): empty list + `unavailable`, never a 500
    if (isMissingTableError(error)) return NextResponse.json({ history: [], unavailable: true });
    console.error('Error fetching search history:', error);
    return NextResponse.json({ error: 'Failed to fetch search history' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const employeeId = await getEmployeeId();
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
    }
    const query = clip(body.query, QUERY_MAX_LENGTH);
    const domain = clip(body.domain, DOMAIN_MAX_LENGTH) || null;

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

    // Rows whose employee was deleted (employeeId null) belong to nobody and would otherwise live forever: clear them opportunistically.
    // Best-effort - a failure here must not fail the recording itself.
    await prisma.searchHistory.deleteMany({ where: { employeeId: null } }).catch(() => {});

    return NextResponse.json({ success: true, entry: created });
  } catch (error) {
    // recording is best-effort: a missing table answers 200 { success: false, unavailable: true } (no console noise in the browser)
    if (isMissingTableError(error)) return NextResponse.json({ success: false, unavailable: true });
    console.error('Error recording search history:', error);
    return NextResponse.json({ error: 'Failed to record search history' }, { status: 500 });
  }
}
