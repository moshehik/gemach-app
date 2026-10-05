import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { mergeDesignPrefs, parseStoredDesignPrefs } from '@/lib/designPrefsSchema';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { syncDesignPrefsCookie } from '@/app/lib/designPrefsCookie';

// העדפות עיצוב פר-עובד — מקור האמת. מאוחסנות כ-JSON בעמודת
// Employee.themeColor (עמודה שהייתה "פלטת גוונים" מתה — אף רכיב לא קרא
// אותה — והוסבה לכאן בלי שינוי סכמה). מזוהה אך ורק לפי cookie
// (auth_token), בלי פרמטר id — עובד לא יכול לקרוא/לעדכן העדפות של אחר.
// אין כתיבת AuditLog ידנית — ההרחבה של Prisma מתעדת את העדכון אוטומטית.
//
// עוגיית designPrefs_<id> (מה ש-app/layout.js קורא לפני הציור, כולל uiVariants) חתומה ב-HMAC וגם נכתבת רק מכאן ומהמסלולים של
// /api/me/ui-variant/* (lib/designPrefsSig.js, GQ-01b): GET בונה אותה מחדש מה-DB כשהיא חסרה / ישנה לא חתומה / מזויפת / פגה
// (DesignPrefsSync קורא ל-GET בכל טעינה מלאה), ו-PUT מרענן אותה אחרי שינוי. ערך מהלקוח לעולם לא נכנס אליה.

async function getSessionEmployee() {
  const cookieStore = await cookies();
  const token = getVerifiedAuthCookie(cookieStore);
  if (!token || !token.value) return null;

  const cookieKey = token.value; // מפתח העוגייה החתומה: זהה למה ש-app/layout.js קורא (designPrefs_${authToken.value})
  const parsedLegacy = /^\d+$/.test(String(token.value)) ? parseInt(token.value, 10) : NaN; // digits only: a UUID that merely STARTS with digits must not match some other employee's legacyId
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { id: token.value },
        ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
      ]
    },
    select: { id: true, themeColor: true, isActive: true }
  });
  return employee ? { employee, cookieKey, cookieStore } : null;
}

export async function GET() {
  try {
    const session = await getSessionEmployee();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { employee } = session;
    if (!employee.isActive) {
      return NextResponse.json({ success: false, error: 'Inactive employee' }, { status: 403 });
    }
    // prefs === null ⇒ לעובד עדיין אין העדפות ב-DB (ערך legacy/ריק) —
    // הלקוח (DesignPrefsSync) מבצע אז הגירה חד-פעמית מההעדפות המקומיות.
    const prefs = parseStoredDesignPrefs(employee.themeColor);
    const res = NextResponse.json({ success: true, employeeId: employee.id, prefs });
    // בונה מחדש / מרענן את עוגיית ה-SSR החתומה מה-DB (no-op כשהיא תקפה ותואמת). cookieRebuilt: העוגייה לא הייתה תקפה.
    const plan = syncDesignPrefsCookie(res, session.cookieStore, session.cookieKey, prefs);
    if (plan.action === 'set' && plan.rebuilt) res.headers.set('x-design-prefs-cookie', 'rebuilt');
    return res;
  } catch (error) {
    console.error('Error fetching design prefs:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getSessionEmployee();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { employee } = session;
    if (!employee.isActive) {
      return NextResponse.json({ success: false, error: 'Inactive employee' }, { status: 403 });
    }

    let body = null;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // מיזוג רדוד של העדכון על ההעדפות הקיימות — שדות לא-מוכרים/לא-תקינים
    // נזרקים בשקט (sanitize), כך שהעמודה לעולם לא מכילה JSON שרירותי.
    // uiVariants (דגלי "ישן / A5", lib/uiVariant.js) נקבעים רק ע"י הבעלים דרך
    // scripts/set-ui-variant.js, או ע"י הנהלה/מתכנת על עצמם דרך POST /api/me/ui-variant/<shell|home> (2026-10-01) —
    // עובד לא יכול להדליק לעצמו מסך חדש דרך ה-API הזה. הערך הקיים
    // נשמר כי mergeDesignPrefs מתחיל מההעדפות השמורות. (זה חוסם רק את המסלול הזה: העוגייה
    // designPrefs_<id> שה-layout קורא חתומה עכשיו ב-HMAC — GQ-01b, ר' lib/designPrefsSig.js — ולכן עריכה בדפדפן כבר לא עוקפת.)
    const safeBody = (body && typeof body === 'object') ? { ...body } : body;
    if (safeBody && typeof safeBody === 'object') {
      delete safeBody.uiVariants;
      // "רישום התחלת עבודה אוטומטי" נכתב רק דרך PUT /api/me/auto-clock-in (lib/autoClockPref.js) - עותק ישן
      // של ההעדפות מהדפדפן (DesignPrefsSync / דף העיצוב) לא ידרוס ערך שנשמר במסך הכניסה או בתפריט.
      delete safeBody.autoClockIn;
    }
    const existing = parseStoredDesignPrefs(employee.themeColor);
    const next = mergeDesignPrefs(existing || {}, safeBody);
    const serialized = JSON.stringify(next);
    if (serialized.length > 8192) {
      return NextResponse.json({ success: false, error: 'Prefs too large' }, { status: 413 });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { themeColor: serialized },
      select: { id: true }
    });

    const res = NextResponse.json({ success: true, prefs: next });
    syncDesignPrefsCookie(res, session.cookieStore, session.cookieKey, next);
    return res;
  } catch (error) {
    console.error('Error updating design prefs:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
