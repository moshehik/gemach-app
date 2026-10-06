import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '../../../lib/auth';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { redactRequestQuery, redactUrl } from '@/lib/redactSensitive';
import { isNoisyVisitUrl, createEmployeeNameCache } from '@/lib/visitLog';
import { measureFields, createVisitLogs } from '@/lib/visitLogMeasure';

// cpu-phase0: שם העובד נשמר בזיכרון האינסטנס (30 דק') במקום findUnique בכל אצווה. הזהות עצמה (id) כבר מאומתת ב-HMAC
// (getVerifiedAuthCookie מחייב עוגיית auth_session חתומה שתואמת ל-auth_token) - רק השם דורש DB, ורק פעם אחת.
const employeeNames = createEmployeeNameCache({
  load: (id) => prisma.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true } }),
});

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    // שני צורות גוף: { entries: [...] } - האצווה שה-interceptor ב-app/layout.js שולח (כל ~60 שנ'
    // או בסגירת הדף), או רשומה בודדת { pageUrl, ... } - דפי ההדפסה (app/print/*) עדיין שולחים כך.
    const rawEntries = Array.isArray(body?.entries) ? body.entries : [body];
    const now = Date.now();
    const entries = rawEntries
      .slice(0, 50)
      .filter((e) => e && typeof e.pageUrl === 'string' && e.pageUrl && !isNoisyVisitUrl(e.pageUrl))
      .map((e) => ({
        // הגנה בעומק: גם אם קליינט ישן/זדוני שולח סיסמה, PIN או ת"ז - לא נשמרים ב-DB (ר' lib/redactSensitive.js)
        pageUrl: redactUrl(e.pageUrl).slice(0, 2000),
        loadingError: e.loadingError ? String(e.loadingError).slice(0, 2000) : null,
        ...measureFields(e), // serverCpuMs / navigationType / serverBootId (אופציונלי; ר' lib/visitLogMeasure.js)
        requestQuery: e.requestQuery ? redactRequestQuery(String(e.requestQuery).slice(0, 4000), e.pageUrl) : null,
        responseSize: typeof e.responseSize === 'number' ? e.responseSize : null,
        executionTime: typeof e.executionTime === 'number' ? e.executionTime : null,
        // חותמת הזמן של הקליינט נשמרת (האצווה נשלחת עד ~60 שנ' אחרי הפעולה) - רק אם סבירה
        timestamp: typeof e.ts === 'number' && e.ts <= now + 60000 && e.ts >= now - 15 * 60000 ? new Date(e.ts) : undefined,
      }));

    if (entries.length === 0) {
      // כל השורות היו רעש אתחול (NOISY_VISIT_PATHS) - לא שגיאה, פשוט אין מה לכתוב
      if (rawEntries.some((e) => e && typeof e.pageUrl === 'string' && isNoisyVisitUrl(e.pageUrl))) return NextResponse.json({ success: true, skipped: true });
      return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authCookie = getVerifiedAuthCookie(cookieStore);

    let employeeId = null;
    let employeeName = 'אורח';
    let isGuest = true;

    if (authCookie && authCookie.value) {
      // auth_token is the Employee's UUID `id`, not a numeric legacyId - store it as-is
      // (PageVisitLog.employeeId is a String field), don't parseInt it.
      const candidateId = authCookie.value;
      const cachedName = await employeeNames.get(candidateId);
      if (cachedName) {
        employeeId = candidateId;
        isGuest = false;
        employeeName = cachedName;
      }
    }

    // סובלני לעמודות מדידה חסרות ב-DB (הקוד נפרס לפני ה-DDL) - ר' lib/visitLogMeasure.js
    await createVisitLogs(prisma, entries.map((e) => ({ ...e, employeeId, employeeName, isGuest })));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log page visit:', error);
    // Return 200 even on error so we don't break the client with tracking failures
    return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 200 });
  }
}
