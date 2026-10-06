import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getCachedSetting } from '@/lib/settingsCache';
import { parseBoardRange, parseBoardLimit, loadBoardOrders } from '@/lib/boardOrders';

export const dynamic = 'force-dynamic';

// GET /api/board/orders?eventDateFrom=ISO&eventDateTo=ISO[&limit=] - ההזמנות שהלוח החודשי החדש צריך לסימן "איחור החזרה", בלבד
// (eventDate/toDate/returnDate + דגלי/תאריכי לקיחה והחזרה של הפריטים) - במקום GET /api/orders?limit=2000 המלא (~531KB לקריאה).
// ר' lib/boardOrders.js. /api/orders עצמו לא השתנה (הלוח הישן, LegacyBoardPage.js, ממשיך להשתמש בו).
// שער: התחברות + page:board - אותו שער כמו /api/board/stages ודף הלוח (app/board/layout.js).
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:board'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const range = parseBoardRange(searchParams);
    if (!range) return NextResponse.json({ error: 'eventDateFrom / eventDateTo לא תקינים' }, { status: 400 });
    const result = await loadBoardOrders({ prisma, getSetting: getCachedSetting, from: range.from, to: range.to, limit: parseBoardLimit(searchParams.get('limit')) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/board/orders error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הזמנות הלוח' }, { status: 500 });
  }
}
