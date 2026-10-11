import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth, HEAD_MANAGEMENT_ROLES } from '../../../lib/auth';
import { verifyEmployeeCredentials } from '../../../lib/employeeAuth';
import { verifySecret } from '@/lib/passwordAuth';
import { redactRequestQuery, redactUrl } from '@/lib/redactSensitive';


export async function GET(request) {
  // היסטוריית הגלישה (נתיבים, גופי בקשות, שמות עובדים) לקריאה: הנהלה ראשית / מתכנת בלבד - כמו הדף /management/history (app/management/layout.js). לפני כן כל עובד מחובר יכול היה לקרוא אותה (R8).
  if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    // page / limit bounded (the legacy page sends 60): limit=1000000 used to stream the whole visit log in one request
    const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), 100000);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '60', 10) || 60, 1), 200);
    const search = searchParams.get('search') || '';
    const employeeId = searchParams.get('employeeId') || ''; // can be "guest", number, or empty
    const sort = searchParams.get('sort') || 'timestamp';
    const order = searchParams.get('order') || 'desc';
    const filterType = searchParams.get('filterType') || ''; // 'api', 'pages', or ''

    const where = {};

    if (search) {
      where.OR = [
        // כתובת עם פרמטר סודי לא נחפשת (pageUrl נשמר גולמי כולל query string; החיפוש בה היה אורקל לערך הפרמטר) - ממצא F11, ביקורת 11.10.2026
        {
          pageUrl: { contains: search },
          NOT: ['token', 'secret', 'pass', 'pwd', 'otp', 'apikey', 'credential', 'authorization', 'bearer', 'gmk_'].map((w) => ({ pageUrl: { contains: `${w}`, mode: 'insensitive' } })),
        },
        // לא מאפשרים חיפוש בתוך גופים שעלולים להכיל סודות (אחרת החיפוש משמש כאורקל לניחוש סיסמאות/PIN/ת"ז בשורות ישנות)
        {
          requestQuery: { contains: search },
          NOT: [
            { pageUrl: { contains: '/api/login' } },
            { pageUrl: { contains: '/api/auth/' } },
            { pageUrl: { contains: '/api/attendance' } },
            ...['assword', '"pin', 'authPin', 'secret', 'token', 'zeout', 'idNumber', 'iban', 'bank', 'card', 'base64'].map((w) => ({
              requestQuery: { contains: w, mode: 'insensitive' },
            })),
          ],
        },
        { loadingError: { contains: search } },
      ];
    }

    if (filterType === 'api') {
      where.pageUrl = { contains: '/api/' };
    } else if (filterType === 'pages') {
      where.NOT = { pageUrl: { contains: '/api/' } };
    }

    if (employeeId) {
      if (employeeId === 'guest') {
        where.isGuest = true;
      } else {
        where.employeeId = employeeId;
      }
    }

    const total = await prisma.pageVisitLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;

    const skip = (page - 1) * limit;

    const rows = await prisma.pageVisitLog.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit,
      // select מפורש (בלי עמודות המדידה serverCpuMs/navigationType/serverBootId): הקוד נפרס לפני ה-DDL שלהן, וקריאה בלי select
      // מבקשת את כל עמודות המודל ותיכשל (P2022) ב-DB שעוד אין בו אותן. ר' docs/cpu-measurement-2026-10-06.md.
      select: {
        id: true, legacyId: true, pageUrl: true, employeeId: true, employeeName: true, timestamp: true,
        loadingError: true, isGuest: true, requestQuery: true, responseSize: true, executionTime: true, updatedAt: true,
      },
    });
    // שורות ישנות (לפני התיקון) עלולות להכיל סיסמאות/PIN/ת"ז בטקסט גלוי - לעולם לא מחזירים אותן לקליינט.
    const data = rows.map((r) => ({
      ...r,
      pageUrl: redactUrl(r.pageUrl),
      requestQuery: redactRequestQuery(r.requestQuery, r.pageUrl),
    }));

    const totalOverall = await prisma.pageVisitLog.count();

    return NextResponse.json({
      success: true,
      data,
      total,
      totalPages,
      totalOverall // for showing alert if > 10000
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

export async function DELETE(request) {
  // Session gate = the audience of the page that offers the deletion (/management/history: head management / programmer, app/management/layout.js). The manager code
  // below is a second factor on top of it, not a replacement: with the old plain checkAuth() any signed-in employee could try unlimited codes (a wrong code answered 401, a
  // valid code of a non-manager 403 - a password oracle) against all active employees, since a blank username scans them all (finding F12, 2026-10-11).
  if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { ids, deleteAll, olderThanDays, password } = body;
    // a non-string username (an object would be read by Prisma as a filter) is treated as "blank"
    const username = typeof body.username === 'string' ? body.username : '';

    // username (employeeId) may legitimately be blank - see the fallback scan below
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, message: 'נדרש שם משתמש וסיסמה לאישור המחיקה' }, { status: 401 });
    }

    // Verify employee credentials - passwords are hashed, so this compares via bcrypt in JS
    // (see lib/employeeAuth.js) rather than a plaintext `password: password` clause.
    let validEmployee = await verifyEmployeeCredentials(username, password);

    // כשהדף שולח לכאן את ה-employeeId שהוחזר מ-customAuthPrompt (PopupProvider) הוא עלול
    // להישאר ריק אם המשתמש לא בחר את עצמו מרשימת "בחר מנהל" - כמו ב-/api/auth/verify-pin,
    // נופלים במקרה הזה לסריקת כל העובדים הפעילים במקום לדחות אישור שכבר תקף.
    if (!validEmployee && !username) {
      const candidates = await prisma.employee.findMany({ where: { isActive: true } });
      for (const candidate of candidates) {
        if (await verifySecret(password, candidate.password)) {
          validEmployee = candidate;
          break;
        }
      }
    }

    if (!validEmployee) {
      return NextResponse.json({ success: false, message: 'שם משתמש או סיסמה שגויים' }, { status: 401 });
    }

    // Check for management role - מנהל סניף (1) וגם הנהלה ראשית/מתכנת (HEAD_MANAGEMENT_ROLES),
    // לא roleId===1 בלבד כמו קודם (חוסר עקביות עם שאר המערכת שנמצא בביקורת חיווט ההרשאות
    // מ-2026-09-22 - הנהלה ראשית ומתכנת דווקא לא הצליחו למחוק דרך הנתיב הזה).
    if (validEmployee.roleId !== 1 && !HEAD_MANAGEMENT_ROLES.includes(validEmployee.roleId)) {
      return NextResponse.json({ success: false, message: 'אין הרשאת ניהול (מנהל) לביצוע פעולה זו' }, { status: 403 });
    }

    if (deleteAll) {
      await prisma.pageVisitLog.deleteMany({});
    } else if (olderThanDays !== undefined && olderThanDays !== null && olderThanDays !== '') {
      const days = parseInt(olderThanDays, 10);
      if (!Number.isFinite(days) || days <= 0) {
        return NextResponse.json({ success: false, message: 'מספר ימים לא תקין' }, { status: 400 });
      }
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.pageVisitLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      return NextResponse.json({ success: true, deletedCount: result.count });
    } else if (Array.isArray(ids) && ids.length > 0) {
      await prisma.pageVisitLog.deleteMany({
        where: { id: { in: ids } }
      });
    } else {
      return NextResponse.json({ success: false, message: 'לא נבחרו רשומות למחיקה' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete history:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת במחיקה' }, { status: 500 });
  }
}
