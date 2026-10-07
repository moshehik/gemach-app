import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getUpdatedOrders } from '@/lib/schedule/updatedOrders';
import { isValidKey, isWithinReasonableRange, todayKey } from '@/lib/schedule/dates';
import { createRangeCache, rangeCacheKey } from '@/lib/schedule/rangeCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// מטמון קצר בזיכרון (אותו דפוס כמו /api/board/stages): זהות ה-DB + מארח + יום + סניף. היום הנוכחי - 30 שניות (עדיין
// "חי"); יום שעבר לא משתנה בפועל - 5 דקות. ההרשאה נבדקת בכל בקשה לפני המטמון; התשובה לא תלויה במשתמש.
const cacheNow = (globalThis.__scheduleUpdatedCacheNow ||= createRangeCache({ ttlMs: 30000, max: 40 }));
const cachePast = (globalThis.__scheduleUpdatedCachePast ||= createRangeCache({ ttlMs: 300000, max: 40 }));
function dbTag() {
  const h = createHash('sha256').update(process.env.DATABASE_URL || '').digest('hex').slice(0, 16);
  return h + ':' + (globalThis.activeDbMode || 'prod') + ':' + ((globalThis.webDbModeState && globalThis.webDbModeState.mode) || 'prod');
}

// GET /api/schedule/updated?date=YYYY-MM-DD[&branch=] — "הזמנות שעודכנו" ביום (lib/schedule/updatedOrders.js).
// נקרא רק כשהמשתמשת מגיעה למקטע בדף הלו״ז (טעינה עצלה), לא בטעינת הדף. שער: התחברות + page:schedule.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:schedule'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const today = todayKey();
    const dayKey = searchParams.get('date') || today;
    if (!isValidKey(dayKey) || !isWithinReasonableRange(dayKey, today)) {
      return NextResponse.json({ error: 'תאריך לא תקין - נדרש YYYY-MM-DD' }, { status: 400 });
    }
    const branch = (searchParams.get('branch') || '').slice(0, 100);
    const cache = dayKey >= today ? cacheNow : cachePast;
    const key = rangeCacheKey({ dbTag: dbTag(), host: request.headers.get('host') || '', from: dayKey, to: dayKey, branch });
    const cached = cache.get(key);
    const result = cached || await getUpdatedOrders({ dayKey, branch }).then((r) => { cache.set(key, r); return r; });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/schedule/updated error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת ההזמנות שעודכנו' }, { status: 500 });
  }
}
