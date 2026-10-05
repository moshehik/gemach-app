import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '../../lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { readVerifiedSession } from '@/lib/auth';
import { createPollService } from '@/lib/pollCounts';

// GET /api/poll - בדיקת הרקע המאוחדת: מונה "לא נקראו" של דיווחי התקלות + של ההתראות ב-invocation אחד
// (היו שתי בקשות נפרדות כל 120 שנ' לכל טאב: /api/error-report?light=1 ו-/api/notifications?light=1).
// הנתיבים הישנים נשארים כמו שהם (עותקי JS ישנים במטמון של הדפדפן + LegacyErrorReportButton הקפוא שמדגום בעצמו).
// הסמנטיקה והרשאות: lib/pollCounts.js. מטמון לכל עובד + הגבלת קצב: lib/pollCache.js.
// ?fresh=1 = עוקף מטמון (הלקוח שולח אותו מיד אחרי פעולה של המשתמש עצמו, למשל "סמן כנקרא").
// Cache-Control: no-store - בכוונה (max-age בדפדפן היה מציג מונה ישן מיד אחרי "סמן כנקרא"); החיסכון מגיע מהמטמון בשרת.
export const dynamic = 'force-dynamic';

const service = createPollService({ prisma, hasPermission });

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    // עוגיית auth_token מאומתת מול הטוקן החתום (HMAC, בלי DB). בלי משתמש מחובר: 401 (הלקוח מפסיק לדגום).
    const token = getVerifiedAuthCookie(cookieStore);
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'לא מורשה' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    // התפקיד מהטוקן החתום הטרי (עד 15 דקות) - בלי שאילתת Employee בכל דגימה; בלעדיו השירות ילך ל-DB רק כשהמטמון ריק.
    const session = readVerifiedSession(cookieStore);
    const fresh = new URL(request.url).searchParams.get('fresh') === '1';

    const result = await service.getPollCounts({
      employeeId: token.value,
      sessionRoleId: session && typeof session.r === 'number' ? session.r : null,
      fresh,
    });
    if (result.error) console.error('Error polling counts:', result.error);

    const headers = { 'Cache-Control': 'no-store' };
    if (result.limited) headers['X-Poll-Limited'] = '1';
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Error polling counts:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
