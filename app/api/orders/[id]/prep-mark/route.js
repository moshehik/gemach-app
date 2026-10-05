import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { resolveOrderRef } from '@/lib/history/orderHistory';
import { computeOrderStages, dayKeyOf } from '@/lib/schedule/orderStages';
import { resolveScheduleSettings } from '@/lib/schedule/settings';
import { applyStageMark, validateMarkInput, MarkError } from '@/lib/schedule/marks';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const intOr = (v, d) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : d; };

// POST /api/orders/[id]/prep-mark — סימון / ביטול "הכנה בוצעה" מכרטיס ההזמנה החדש (W6, החלטת הבעלים AMB-08 (B), 2026-10-04:
// כל עובדת שפותחת הזמנה רשאית לסמן, גם בלי הרשאת לו״ז).
//   { action: 'mark' | 'unmark', dayKey?: 'YYYY-MM-DD' }
// למה נקודת קצה נפרדת: POST /api/schedule/marks סגור בכוונה בלי page:schedule (סגור כברירת מחדל) ואסור לרופף אותו. כאן:
//   - שער: checkAuth + page:orders (כמו כל לשוניות הכרטיס) + עובדת מחוברת בפועל (אורח במצב פתוח לא מסמן)
//   - רק שלב ההכנה ('prep') ורק של ההזמנה הזו: ה-stageKey קבוע בשרת, וה-dayKey של השלב מחושב בשרת מהגדרות הלו״ז (לא סומכים על
//     הלקוח; אם הלקוח שלח dayKey אחר - 409 "הנתונים השתנו")
//   - הכתיבה = אותה פונקציה בדיוק (applyStageMark): אותה שורת ScheduleStageMark, אותה שורת audit מסוגנת (SCHEDULE_STAGE_DONE /
//     UNDONE) שמופיעה בהיסטוריה כ"סומן 'בוצע' בלו״ז · הכנה", אותן בדיקות 409 (כבר סומן ע"י אחרת, ההזמנה לא בשלב), 503 (הטבלה חסרה)
// תשובה: { ok, status: 'marked'|'unmarked'|'unchanged', row } (כמו POST /api/schedule/marks)
export async function POST(request, { params }) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await getSessionEmployee();
    if (!user || !user.id) return json({ error: 'יש להתחבר כדי לסמן "בוצע"' }, 401);

    const { id } = await params;
    const ref = resolveOrderRef(id);
    if (!ref) return json({ error: 'Order not found' }, 404);

    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const b = body && typeof body === 'object' ? body : {};
    const action = String(b.action || '');
    if (action !== 'mark' && action !== 'unmark') return json({ error: 'פעולה לא מוכרת' }, 400);
    const wantedDay = b.dayKey === undefined || b.dayKey === null || b.dayKey === '' ? null : String(b.dayKey);
    if (wantedDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(wantedDay)) return json({ error: 'תאריך לא תקין - נדרש YYYY-MM-DD' }, 400);

    const order = await prisma.order.findUnique({
      where: ref.id ? { id: ref.id } : { orderId: ref.orderId },
      select: {
        id: true, orderId: true, orderDate: true, isDeleted: true,
        eventDate: true, fromDate: true, toDate: true, returnDate: true, isAbroad: true,
        isDelivery: true, deliveryDirection: true, deliveryOneDayBefore: true,
        items: {
          select: {
            id: true, isDeleted: true, neckAlteration: true, sleeveAlteration: true, lengthAlteration: true, alterationDone: true,
            isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true,
          },
        },
      },
    });
    if (!order) return json({ error: 'Order not found' }, 404);

    const settingsRows = await getAllCachedSettings().catch(() => []);
    const map = {};
    for (const r of settingsRows || []) if (r && r.key) map[r.key] = r.value;
    const schedule = resolveScheduleSettings(map);
    const delivery = { daysBefore: intOr(map.delivery_days_before, 1), daysAfter: intOr(map.delivery_days_after, 1), skipWeekends: map.delivery_skip_weekends === 'true' };
    const now = new Date();
    const { stages } = computeOrderStages({ ...order, items: order.items || [] }, { schedule, delivery, marks: [], todayKey: dayKeyOf(now) });
    const prep = stages.find((s) => s.key === 'prep');
    if (!prep) return json({ error: 'שלב ההכנה כבוי בהגדרות הלו״ז או לא רלוונטי להזמנה הזו - אי אפשר לסמן בו "בוצע".' }, 409);
    if (wantedDay && wantedDay !== prep.dayKey) return json({ error: 'הנתונים השתנו (תאריכי ההזמנה או הגדרות הלו״ז) - רעננו את הכרטיס ונסו שוב.', stale: true }, 409);

    // stageKey / dayKey / orderId כולם מהשרת - הגוף של הלקוח לא יכול לכוון את הסימון לשלב או להזמנה אחרים
    const input = validateMarkInput({ action, stageKey: 'prep', dayKey: prep.dayKey, orderId: order.orderId, source: 'row' }, { today: dayKeyOf(now) });
    const result = await applyStageMark(input, { user, now });
    const r = result.results[0];
    if (!r) return json({ error: 'ההזמנה לא נמצאת בשלב ההכנה ביום הזה - ייתכן שהתאריכים השתנו. רעננו את הכרטיס.' }, 409);
    if (r.status === 'blocked') return r.blocked;
    return json({ ok: true, status: r.status, row: r.row });
  } catch (error) {
    if (error instanceof MarkError) return json({ error: error.message, ...(error.extra || {}) }, error.status);
    console.error('POST /api/orders/[id]/prep-mark error:', error);
    return json({ error: 'שגיאה בשמירת הסימון' }, 500);
  }
}
