import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { canOpenPage, canOpenAnyPage, getEmployeeEffectiveValue, hasPermission } from '@/lib/permissions';
import { verifySecret } from '@/lib/passwordAuth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getScheduleDay, isScheduleManager } from '@/lib/schedule';
import { isValidKey } from '@/lib/schedule/dates';
import { PRINT_PAGES, parsePageList, parseVersions, getPrintPage } from '@/lib/schedule/print/registry';
import { loadExtras, buildPrintPayload, payloadToRows } from '@/lib/schedule/print/data';
import { parseExportLimit } from '@/lib/schedule/print/exportLimit';
import { printNotices } from '@/lib/schedule/print/notices';
import { hasOrderIdParam, parseOrderIdParam, orderModePageError, orderModeVersions } from '@/lib/schedule/print/orderMode';
import { loadSingleOrderDay, SingleOrderError } from '@/lib/schedule/print/singleOrder';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // כמו GET /api/schedule (אותן שאילתות + שאילתת extras אחת)

// GET /api/schedule/print?page=PP-01[,PP-15]&date=YYYY-MM-DD[&branch=..][&version=b | PP-03:b,PP-07:a][&format=json|rows]
//   נתוני ההדפסה של דף אחד או כמה דפים מאותו יום. getScheduleDay רץ פעם אחת לכל הבקשה (לא לכל דף).
//   format=json (ברירת מחדל): { meta, pages:[{ key, version, def, data, pageCode }] } - מה שדף ההדפסה מרנדר.
//   format=rows: { meta, sheets:[{ key, label, sheetName, rows }], total, limit } - שורות שטוחות לייצוא Excel.
//     מגבלת שורות לייצוא נאכפת כאן בשרת (החלטת הבעלים D6): total > feature:export_max_rows של העובד ->
//     403 { code:'EXPORT_LIMIT', total, limit } - ואז POST עם approvalPin (ר' למטה).
// שערים (סגור כברירת מחדל, כמו /api/schedule): התחברות + page:schedule; ולכל דף גם extraPageKeys שלו
// (lib/schedule/print/registry.js - אותן הרשאות שההדפסות הקיימות דורשות: מחירים -> page:orders/…,
// משלוחים -> page:deliveries, תיקונים -> page:alterations/…) - דף שאסור לעובד/ת מדולג ומדווח ב-meta.skipped
// (הדפים האחרים מודפסים); רק כשכל הדפים שנבחרו אסורים -> 403.
// format=access (בלי page): { allowed:[keys], forbidden:[keys] } - האשף מנטרל את הדפים האסורים מראש.
// 400 = פרמטר שגוי, 404 = מפתח דף לא קיים/הוסר, 501 = דף רשום שעדיין לא נבנה.
// orderId=N (כרטיס הזמנה, W7): הדף להזמנה אחת בלבד, בלי קשר ליום - רק PP-07 (גרסה ב׳ בכפייה) ו-PP-12 (רק להזמנה עם משלוח הלוך),
//   format=json בלבד; הנתונים נבנים מההזמנה (lib/schedule/print/singleOrder.js) ו-meta.orderId נושא את מספרה. אותם שערים כמו כל דף.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handle({
    page: searchParams.get('page'),
    date: searchParams.get('date'),
    branch: searchParams.get('branch'),
    version: searchParams.get('version'),
    format: searchParams.get('format') || 'json',
    orderIdRaw: searchParams.get('orderId'),
  });
}

// POST /api/schedule/print  { page, date, branch?, version?, format:'rows', approvalPin? }
//   אותו דבר כמו GET, בגוף הבקשה (כדי שסיסמת האישור לא תעבור בכתובת). approvalPin = סיסמה של עובד/ת עם
//   feature:export_over_limit_approval (אותה בדיקה כמו POST /api/auth/verify-pin, רק שהאישור נבדק באותה בקשה
//   שמחזירה את השורות - אין "דגל אישור" בדפדפן שאפשר לעקוף).
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'גוף הבקשה אינו JSON תקין' }, { status: 400 }); }
  body = body || {};
  return handle({
    page: typeof body.page === 'string' ? body.page : Array.isArray(body.page) ? body.page.join(',') : '',
    date: body.date,
    branch: body.branch,
    version: typeof body.version === 'string' ? body.version : '',
    format: body.format || 'rows',
    approvalPin: typeof body.approvalPin === 'string' ? body.approvalPin : '',
  });
}

async function handle({ page, date, branch, version, format, approvalPin, orderIdRaw = null }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:schedule'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // format=access: אילו דפים העובד/ת רשאי/ת להדפיס (האשף מנטרל את השאר) - בלי שאילתת נתונים
  if (format === 'access') {
    const allowed = [];
    const forbidden = [];
    for (const def of PRINT_PAGES) (await pageAllowed(def) ? allowed : forbidden).push(def.key);
    return NextResponse.json({ allowed, forbidden }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const { keys: requestedKeys, bad, removed } = parsePageList(page);
  if (bad.length) return NextResponse.json({ error: `דף לא מוכר: ${bad.join(', ')}` }, { status: 404 });
  if (removed.length && !requestedKeys.length) return NextResponse.json({ error: `הדף הוסר מהסט: ${removed.join(', ')}` }, { status: 404 });
  if (!requestedKeys.length) return NextResponse.json({ error: 'נדרש פרמטר page (למשל PP-15)' }, { status: 400 });
  if (date && !isValidKey(date)) return NextResponse.json({ error: 'תאריך לא תקין - נדרש YYYY-MM-DD' }, { status: 400 });
  if (format !== 'json' && format !== 'rows') return NextResponse.json({ error: 'format לא נתמך' }, { status: 400 });
  // מצב הזמנה בודדת: מוודאים את הפרמטרים לפני כל שאילתה (פרמטר שגוי = 400, לא מתעלמים ממנו בשקט)
  const singleOrderId = hasOrderIdParam(orderIdRaw) ? parseOrderIdParam(orderIdRaw) : null;
  if (hasOrderIdParam(orderIdRaw)) {
    if (!singleOrderId) return NextResponse.json({ error: 'orderId לא תקין' }, { status: 400 });
    const pageErr = orderModePageError(requestedKeys);
    if (pageErr) return NextResponse.json({ error: pageErr }, { status: 400 });
    if (format !== 'json') return NextResponse.json({ error: 'הדפסת הזמנה בודדת זמינה רק ב-format=json' }, { status: 400 });
  }

  // הרשאה נוספת לכל דף (any-of בתוך הדף) - נבדקת לפני כל שאילתה. דף אסור מדולג (meta.skipped) ולא מפיל את
  // כל הבקשה; רק כשכל הדפים שנבחרו אסורים -> 403.
  const defs = [];
  const skipped = [];
  for (const def of requestedKeys.map(getPrintPage)) {
    if (await pageAllowed(def)) defs.push(def);
    else skipped.push({ key: def.key, label: def.label, reason: 'אין הרשאה' });
  }
  if (!defs.length) {
    const first = skipped[0];
    return NextResponse.json({ error: skipped.length === 1 ? `אין הרשאה להדפיס את "${first.label}"` : `אין הרשאה להדפיס את הדפים שנבחרו: ${skipped.map((x) => x.label).join(', ')}`, page: first.key, pages: skipped.map((x) => x.key) }, { status: 403 });
  }
  const keys = defs.map((d) => d.key);
  const notBuilt = defs.filter((d) => d.status !== 'ready');
  if (notBuilt.length) {
    return NextResponse.json({ error: `הדף עדיין לא נבנה: ${notBuilt.map((d) => d.label).join(', ')}`, pages: notBuilt.map((d) => d.key) }, { status: 501 });
  }

  try {
    const user = await getSessionEmployee();
    // Excel (format=rows) = ה-XL של הלו״ז: רק למי שרואה את לחצן ה-XL (JDG-04 - הנהלה ראשית / מנהלת סניף / מתכנת,
    // isScheduleManager). בלי זה עובדת הייתה מקבלת Excel דרך "הורדה" באשף. PDF והדפסה פתוחים לכל מי שיש לו page:schedule.
    if (format === 'rows' && !isScheduleManager(user)) {
      return NextResponse.json({ error: 'ייצוא ל-Excel זמין להנהלה בלבד. אפשר להוריד PDF או להדפיס.', code: 'EXPORT_FORBIDDEN' }, { status: 403 });
    }
    const branchParam = (branch || '').toString().slice(0, 100);
    const [day, settingsRows, me] = await Promise.all([
      singleOrderId
        ? loadSingleOrderDay({ orderId: singleOrderId, keys })
        : getScheduleDay({ date: date || undefined, branch: branchParam, user }),
      getAllCachedSettings().catch(() => []),
      user && user.id
        ? prisma.employee.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, fullName: true } }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const setting = (k) => { const r = (settingsRows || []).find((s) => s && s.key === k); return r ? r.value : ''; };
    const gmach = { name: setting('gmach_name') || 'גמ״ח שמלות', address: setting('gmach_address') || '', phone: setting('gmach_phone') || '' };
    const printedBy = me ? (me.fullName || [me.firstName, me.lastName].filter(Boolean).join(' ')) : '';
    const extras = await loadExtras(day, defs);
    // הזמנה בודדת: דף הכנה תמיד בגרסה ב׳ (הזמנה בעמוד נפרד), בלי קשר לפרמטר version
    const versions = singleOrderId ? { ...parseVersions(version, keys), ...orderModeVersions(keys) } : parseVersions(version, keys);
    const payload = buildPrintPayload({ day, keys, versions, extras, gmach, printedBy });
    payload.meta.skipped = skipped;

    if (format === 'json') return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });

    // ---- format=rows: מגבלת ייצוא בשרת (D6) ----
    const sheets = payloadToRows(payload);
    const total = sheets.reduce((s, sh) => s + sh.rows.length, 0);
    const limitRaw = user ? await getEmployeeEffectiveValue(user, 'feature:export_max_rows') : null;
    const limit = parseExportLimit(limitRaw);
    if (total > limit) {
      const ok = approvalPin ? await verifyExportApproval(approvalPin) : false;
      if (!ok) {
        return NextResponse.json(
          { error: approvalPin ? 'סיסמת האישור שגויה או שאין למאשר/ת הרשאה לאשר ייצוא מעל המגבלה' : `הייצוא כולל ${total} שורות, מעל המגבלה (${limit}). נדרש אישור מנהל/ת.`, code: 'EXPORT_LIMIT', total, limit },
          { status: 403 },
        );
      }
    }
    // notices = "הרשימה עלולה להיות חלקית" (קיצוץ / אזהרות / דפים שדולגו) - האשף כותב אותן לגיליון "הערות" בקובץ
    return NextResponse.json({ meta: payload.meta, sheets, total, limit, notices: printNotices(payload) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error && error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof SingleOrderError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('GET /api/schedule/print error:', error);
    return NextResponse.json({ error: 'שגיאה בהכנת נתוני ההדפסה' }, { status: 500 });
  }
}

// אותה בדיקה כמו POST /api/auth/verify-pin עם requiredLevel feature:export_over_limit_approval: הסיסמה של
// עובד/ת פעיל/ה (bcrypt, verifySecret) שמחזיק/ה את פריט האישור בקטלוג ההרשאות.
async function pageAllowed(def) {
  return !(def.extraPageKeys && def.extraPageKeys.length) || canOpenAnyPage(def.extraPageKeys);
}

async function verifyExportApproval(pin) {
  try {
    const candidates = await prisma.employee.findMany({ where: { isActive: true } });
    for (const c of candidates) {
      if (!c.password) continue;
      if (await verifySecret(pin, c.password)) return hasPermission(c, 'feature:export_over_limit_approval');
    }
  } catch (e) {
    console.error('schedule/print export approval failed', e);
  }
  return false;
}
