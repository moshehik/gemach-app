import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getHebrewDateString, getIsraelTodayDate } from '@/lib/hebrewDate';
import { getCustomerHistory, decodeCursor, normalizeLimit } from '@/lib/history/customerHistory';
import { CATEGORIES, isUuidShaped } from '@/lib/history/labels';

// GET /api/customers/[id]/history?limit=100&cursor=<opaque>&category=cust,orders,pay,docs
//
// Returns { entries, nextCursor, counts, countsScope: 'feed', meta }. Entries carry the actor's NAME only.
//
// One unified, newest-first history feed for the customer card (customer edits exploded to one
// entry per field, orders opened, payments, refunds, mails). READ-ONLY: nothing here writes
// AuditLog rows - the Prisma extension already logs every real write. All the work is in
// lib/history/customerHistory.js (pure mappers + bounded reads).
//
// Access: same as GET /api/customers/[id] (any logged-in employee; the customers page itself is
// gated by page:customers).
export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    // Customer.id is a uuid(): any other shape (NUL byte, ...) cannot exist -> 404 before Prisma is touched (ID-1)
    if (!isUuidShaped(id)) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get('limit'));

    const cursor = searchParams.get('cursor');
    if (cursor && !decodeCursor(cursor)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    let categories = null;
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const wanted = categoryParam.split(',').map((s) => s.trim()).filter(Boolean);
      const unknown = wanted.filter((c) => !CATEGORIES.includes(c));
      if (unknown.length) {
        return NextResponse.json({ error: `Unknown category: ${unknown.join(',')}` }, { status: 400 });
      }
      if (wanted.length) categories = new Set(wanted);
    }

    // The existence check runs IN PARALLEL with the feed reads (one round less on a cold Neon connection,
    // R20); every read is bounded, so an unknown id costs a few empty queries and then a 404.
    const [customer, result] = await Promise.all([
      prisma.customer.findUnique({ where: { id }, select: { id: true } }),
      getCustomerHistory(prisma, id, {
        limit,
        cursor,
        categories,
        // Hebrew calendar date of the ISRAEL day the event happened on (servers run in UTC)
        hebrewDate: (date) => getHebrewDateString(getIsraelTodayDate(date)),
      }),
    ]);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({
      entries: result.entries,
      nextCursor: result.nextCursor,
      counts: result.counts,
      // 'feed': the badges count the whole assembled feed (every category, before paging and the category
      // filter) = the newest SOURCE_CAP rows of each source; meta.truncated names a source that hit its cap
      countsScope: result.countsScope,
      meta: result.meta,
    });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
