import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { runGlobalSearch } from '@/lib/globalSearch';

// GET /api/global-search?q=...[&extras=1]
// החיפוש הראשי של דף הבית, שורת החיפוש העליונה והדף הישן. כל הלוגיקה (שאילתות, תכנית החיפוש, הרשאות השורות הנוספות) ב-lib/globalSearch.js.
//  - בלי extras: { customers, orders, rentals } בלבד, כמו תמיד (הצרכנים הישנים). orders[].computedStatus נוסף (הסטטוס המחושב); status נשאר כפי שנשמר.
//  - extras=1 (רק הבית החדש): בנוסף inventory (שורות "מלאי" לברקוד / מילות מפתח), inventoryTruncated ו-dateChips (הלו"ז ליום שהוקלד).
// SECURITY: רק עמודות מפורשות בכל SELECT (ר' lib/globalSearch.js ו-scripts/test_search_leak_gate.mjs); כל עובד מחובר יכול לקרוא לנתיב הזה.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const extras = searchParams.get('extras') === '1';

  if (!q) {
    return NextResponse.json({ customers: [], orders: [], rentals: [] });
  }

  try {
    return NextResponse.json(await runGlobalSearch(q, { extras }));
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Failed to perform global search' }, { status: 500 });
  }
}
