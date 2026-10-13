import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAttendanceViewer } from '@/lib/attendance/server';
import { pickLatestOpenShift } from '@/lib/openShift';
import { shiftClockInfo } from '@/lib/menu/shiftClock';

// GET /api/employees/presence - "מחובר עכשיו" + "כניסה אחרונה" לכל עובד, לרשימת העובדים החדשה (app/components/employees-list, 9.10.2026).
// אין עמודה כזאת ב-Employee, ולכן הנתון נגזר ממשמרות (Shift) הקיימות - בלי שינוי סכמה, קריאה בלבד:
//   lastSite = החיבור האחרון של העובד לאתר עצמו (MAX timestamp ב-PageVisitLog לפי employeeId; נשמר ב-instance 5 דקות כדי לא לסרוק את הטבלה בכל דגימה).
//   lastEntry = שעת הכניסה המאוחרת ביותר של משמרת לא מחוקה (MAX entryTime) - "כניסה אחרונה" בשעון הנוכחות.
//   connected = יש לעובד משמרת פתוחה (exitTime=null, לא מחוקה) שהתחילה לפני פחות מ-16 שעות (MAX_PLAUSIBLE_SHIFT_MS) - אותו כלל כמו
//               שעון "במשמרת" שבתפריט העליון (lib/menu/shiftClock.js): משמרת ישנה שנשכח לסגור לא נחשבת "מחובר". shiftMinutes = משך המשמרת.
// השער: אותו שער כמו דף העובדים (הנהלה ראשית / מתכנת) - getAttendanceViewer().isManager, נכשל סגור. תשובה: { items: { <employeeId>: { lastEntry, connected, shiftMinutes } } }.
export const dynamic = 'force-dynamic';

const SITE_TTL_MS = 5 * 60 * 1000;
let siteCache = { at: 0, map: {} };
async function loadLastSite(now) {
  if (now - siteCache.at < SITE_TTL_MS) return siteCache.map;
  const rows = await prisma.pageVisitLog.groupBy({ by: ['employeeId'], where: { employeeId: { not: null } }, _max: { timestamp: true } });
  const map = {};
  for (const r of rows) if (r.employeeId && r._max.timestamp) map[r.employeeId] = r._max.timestamp.toISOString();
  siteCache = { at: now, map };
  return map;
}

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const viewer = await getAttendanceViewer();
  if (!viewer) return json({ success: false, error: 'Unauthorized' }, 401);
  if (!viewer.isManager) return json({ success: false, error: 'Forbidden' }, 403);
  try {
    const [last, open, site] = await Promise.all([
      prisma.shift.groupBy({ by: ['employeeId'], where: { isDeleted: false, entryTime: { not: null } }, _max: { entryTime: true } }),
      prisma.shift.findMany({ where: { isDeleted: false, exitTime: null, entryTime: { not: null } }, select: { id: true, employeeId: true, entryTime: true } }),
      loadLastSite(Date.now()).catch(() => ({})), // כשל בנתון המשני לא מפיל את הנוכחות
    ]);
    const now = Date.now();
    const items = {};
    for (const r of last) items[r.employeeId] = { lastEntry: r._max.entryTime ? r._max.entryTime.toISOString() : null, connected: false, shiftMinutes: null };
    const byEmp = new Map();
    for (const s of open) { if (!byEmp.has(s.employeeId)) byEmp.set(s.employeeId, []); byEmp.get(s.employeeId).push(s); }
    for (const [empId, shifts] of byEmp) {
      const cur = pickLatestOpenShift(shifts);
      const info = cur ? shiftClockInfo(cur.entryTime, now) : null;
      if (!items[empId]) items[empId] = { lastEntry: cur && cur.entryTime ? cur.entryTime.toISOString() : null, connected: false, shiftMinutes: null };
      if (info && info.kind === 'ok') {
        items[empId].connected = true;
        items[empId].shiftMinutes = Math.max(0, Math.floor((now - new Date(cur.entryTime).getTime()) / 60000));
      }
    }
    for (const [empId, iso] of Object.entries(site)) {
      if (!items[empId]) items[empId] = { lastEntry: null, connected: false, shiftMinutes: null };
      items[empId].lastSite = iso;
    }
    return json({ success: true, now: new Date(now).toISOString(), items });
  } catch (e) {
    console.error('Error in /api/employees/presence:', e);
    return json({ success: false, error: 'Internal Server Error' }, 500);
  }
}
