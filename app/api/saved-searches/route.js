import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// Smart quick-search `$` trigger (docs/smart-quick-search-plan-2026-09-27.md, Part 2) -
// searches the current employee has explicitly named/saved for reuse. Always scoped to
// the employeeId derived from the auth_token cookie server-side - never a client-supplied
// employee id, same as app/api/me/design-prefs/route.js. Phase 1 only saves a free-text
// query (+ optional domain); filtersJson is reserved for a future advanced-search phase.
const SAVED_SEARCH_LIMIT = 50;
const LABEL_MAX_LENGTH = 80;
const QUERY_MAX_LENGTH = 300;
const DOMAIN_MAX_LENGTH = 40;

// The identity is the VERIFIED auth_token (a signed auth_session naming the same employee),
// never the raw cookie - see CLAUDE.md "Auth cookie forgery". checkAuth() alone is not enough
// here: while require_login is off it passes anonymous requests too, so a raw read would let
// a hand-typed auth_token (any employee id from the public login picker) read, create and
// delete that employee's rows.
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

    const savedSearches = await prisma.savedSearch.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: SAVED_SEARCH_LIMIT,
    });

    return NextResponse.json({ savedSearches });
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
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
    const label = clip(body.label, LABEL_MAX_LENGTH);
    const query = clip(body.query, QUERY_MAX_LENGTH);
    const domain = clip(body.domain, DOMAIN_MAX_LENGTH) || null;

    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const created = await prisma.savedSearch.create({
      data: { employeeId, label, query, domain },
    });

    return NextResponse.json({ success: true, savedSearch: created });
  } catch (error) {
    console.error('Error creating saved search:', error);
    return NextResponse.json({ error: 'Failed to create saved search' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const employeeId = await getEmployeeId();
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.savedSearch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    }
    if (existing.employeeId !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.savedSearch.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
  }
}
