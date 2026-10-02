import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { canOpenPage, canOpenAnyPage, hasPermission } from '@/lib/permissions';
import { applyStageMark, listOrderMarks, validateMarkInput, MarkError, MARK_ALL_PERMISSION } from '@/lib/schedule/marks';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/schedule/marks — סימון "בוצע" בלו״ז היומי (lib/schedule/marks.js).
//   { action: 'mark' | 'unmark', stageKey, dayKey: 'YYYY-MM-DD', orderId, outcome?: 'ok' | 'not_ok' }
//   { action: 'mark_all', stageKey, dayKey, orderIds?: number[] }   (רק מי שיש לו feature:schedule_mark_all_done)
//   outcome רק לשלבי ההחזרה (8, 9); ברירת מחדל 'ok' ("בוצע" = הוחזר תקין, החלטה A4).
//   overridePin / overrideEmployeeId (אופציונלי): עקיפת מנהל להגנת ההחזרה המוקדמת בשלב 8 - אותו מנגנון כמו
//   POST /api/rentals/toggle (lib/earlyReturnGuard.js). בלי עקיפה - 409 עם earlyReturn:true.
// תשובה (mark/unmark): { ok, status: 'marked'|'unmarked'|'unchanged', row: <טלאי לשורה> }
// תשובה (mark_all):    { ok, rows: [<טלאי>], skipped: [{orderId, reason}], counts: {marked, unchanged, blocked} }
// שגיאות: 400 קלט, 401 בלי התחברות (גם אורח במצב פתוח - סימון דורש עובדת), 403 בלי page:schedule או בלי
// הרשאת "הכל בוצע", 409 ההזמנה לא בשלב/יום או השלב כבוי או החזרה מוקדמת, 503 הטבלה עדיין לא נוצרה.
// שער: אותו דפוס כמו GET /api/schedule - checkAuth + canOpenPage('page:schedule') בשרת, סגור כברירת מחדל.
export async function POST(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await canOpenPage('page:schedule'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  try {
    const user = await getSessionEmployee();
    if (!user || !user.id) return NextResponse.json({ error: 'יש להתחבר כדי לסמן "בוצע"' }, { status: 401, headers: NO_STORE });

    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const input = validateMarkInput(body);

    if (input.action === 'mark_all' && !(await hasPermission(user, MARK_ALL_PERMISSION))) {
      return NextResponse.json({ error: 'אין הרשאה ל"הכל בוצע" - אפשר לסמן שורה-שורה' }, { status: 403, headers: NO_STORE });
    }

    const result = await applyStageMark(input, { user });

    if (input.action !== 'mark_all') {
      const r = result.results[0];
      if (!r) return NextResponse.json({ error: 'ההזמנה לא נמצאה בשלב' }, { status: 409, headers: NO_STORE });
      if (r.status === 'blocked') return r.blocked; // 409 מהגנת ההחזרה המוקדמת, עם earlyReturn:true
      return NextResponse.json({ ok: true, status: r.status, row: r.row }, { headers: NO_STORE });
    }

    const rows = [];
    const skipped = [];
    const counts = { marked: 0, unchanged: 0, blocked: 0 };
    for (const r of result.results) {
      if (r.status === 'blocked') {
        counts.blocked++;
        skipped.push({ orderId: r.orderId, reason: 'early_return' });
        continue;
      }
      if (r.status === 'unchanged') counts.unchanged++; else counts.marked++;
      rows.push(r.row);
    }
    return NextResponse.json({ ok: true, rows, skipped, counts }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof MarkError) {
      return NextResponse.json({ error: error.message, ...(error.extra || {}) }, { status: error.status, headers: NO_STORE });
    }
    console.error('POST /api/schedule/marks error:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הסימון' }, { status: 500, headers: NO_STORE });
  }
}

// GET /api/schedule/marks?orderId=123 — הסימונים של הזמנה אחת (לכרטיס ההזמנה, טאב "מידע").
// { available, marks: [{ stageKey, stageNumber, stageLabel, dayKey, done, outcome, markedBy, markedAt, undoneBy, undoneAt }] }
// הטבלה חסרה -> { available: false, marks: [] } (200). שער: page:schedule או page:orders.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await canOpenAnyPage(['page:schedule', 'page:orders']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  try {
    const { searchParams } = new URL(request.url);
    const raw = String(searchParams.get('orderId') || '').trim();
    if (!/^\d{1,9}$/.test(raw)) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400, headers: NO_STORE });
    const result = await listOrderMarks(parseInt(raw, 10));
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error('GET /api/schedule/marks error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הסימונים' }, { status: 500, headers: NO_STORE });
  }
}
