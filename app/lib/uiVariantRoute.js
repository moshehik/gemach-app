import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { applyUiVariantRequest, describeSelfSwitch } from '@/lib/uiVariantSelfSwitch';

// הדבק של ה-routes של /api/me/ui-variant/* (shell, home) ושל GET /api/me/ui-variant: זיהוי העובד, קריאת הגוף,
// קריאה לליבה הטהורה (lib/uiVariantSelfSwitch.js — שם כל כללי ההרשאה והבדיקות) ורענון עוגיית designPrefs_<id>.
//
// מזוהה אך ורק לפי העוגייה החתומה (כמו design-prefs) — אין פרמטר id, עובד לא יכול לשנות לעובד אחר. התפקיד
// (Employee.roleId) נקרא מה-DB, לא מהגוף / מהעוגייה. הכתיבה היא prisma.employee.update רגיל → הרחבת ה-AuditLog
// ב-app/lib/prisma.js רושמת אותה (UPDATE Employee); אין רישום ידני.

const DESIGN_PREFS_COOKIE_MAX_AGE = 31536000; // שנה, כמו writeDesignPrefsCookie בלקוח

async function getSessionEmployee() {
  const cookieStore = await cookies();
  const token = getVerifiedAuthCookie(cookieStore);
  if (!token || !token.value) return null;

  const parsedLegacy = /^\d+$/.test(String(token.value)) ? parseInt(token.value, 10) : NaN; // digits only (see design-prefs/route.js)
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { id: token.value },
        ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
      ]
    },
    select: { id: true, themeColor: true, isActive: true, roleId: true }
  });
  return employee ? { employee, cookieKey: token.value, cookieStore } : null;
}

// אותו payload שהלקוח כותב ב-writeDesignPrefsCookie (רק מה ש-SSR צריך לפני הציור + uiVariants).
// השדות החזותיים נלקחים מה-DB, ואם שם הם חסרים (עובד/ת שעדיין לא עבר/ה את ההגירה החד-פעמית של DesignPrefsSync)
// — מהעוגייה הקיימת, כדי שהכתיבה מהשרת לא תמחק פלטה/גופן שחיים רק בדפדפן. uiVariants: תמיד מה-DB (המקור).
const COOKIE_VISUAL_FIELDS = ['palette', 'font', 'density', 'textScale', 'customColors'];
function cookiePayloadFromPrefs(prefs, existingCookieRaw) {
  let existing = {};
  if (typeof existingCookieRaw === 'string' && existingCookieRaw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(existingCookieRaw));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
    } catch (e) { existing = {}; }
  }
  const payload = {};
  for (const k of COOKIE_VISUAL_FIELDS) payload[k] = prefs[k] !== undefined ? prefs[k] : existing[k];
  if (prefs.uiVariants) payload.uiVariants = prefs.uiVariants;
  return payload;
}

/** POST /api/me/ui-variant/<screen> */
export async function handleUiVariantPost(request, screen) {
  try {
    const session = await getSessionEmployee();

    let body = null;
    let bodyParseFailed = false;
    if (session) {
      try {
        body = await request.json();
      } catch (e) {
        bodyParseFailed = true;
      }
    }

    const result = await applyUiVariantRequest({
      screen,
      body,
      bodyParseFailed,
      employee: session ? session.employee : null,
      prisma,
    });

    const res = NextResponse.json(result.json, { status: result.status });
    if (result.status === 200 && result.nextPrefs && session) {
      // המפתח של העוגייה הוא ערך ה-auth_token (כך ה-layout קורא אותה: designPrefs_${authToken.value}).
      // Next מקודד את הערך (encodeURIComponent) בכתיבה ומפענח בקריאה — אותו פורמט כמו document.cookie בלקוח.
      try {
        const cookieName = `designPrefs_${session.cookieKey}`;
        res.cookies.set({
          name: cookieName,
          value: JSON.stringify(cookiePayloadFromPrefs(result.nextPrefs, session.cookieStore.get(cookieName)?.value)),
          path: '/',
          sameSite: 'lax',
          maxAge: DESIGN_PREFS_COOKIE_MAX_AGE,
        });
      } catch (e) {
        // העוגייה היא רק מראה מהירה; בלי רענון שלה DesignPrefsSync ירענן אותה בטעינה הבאה.
        console.warn(`ui-variant/${screen}: failed to refresh designPrefs cookie:`, e?.message || e);
      }
    }
    return res;
  } catch (error) {
    console.error(`Error updating ${screen} ui-variant override:`, error);
    return NextResponse.json({ success: false, error: 'שגיאת שרת' }, { status: 500 });
  }
}

/** GET /api/me/ui-variant — האם העובד המחובר רשאי לעבור בעצמו (להצגת הסעיף בדף "עיצוב ותצוגה"). */
export async function handleUiVariantGet() {
  try {
    const session = await getSessionEmployee();
    if (!session) return NextResponse.json({ success: false, error: 'לא מחובר/ת' }, { status: 401 });
    if (!session.employee.isActive) return NextResponse.json({ success: false, error: 'העובד/ת אינו פעיל/ה' }, { status: 403 });
    return NextResponse.json({ success: true, ...describeSelfSwitch(session.employee) });
  } catch (error) {
    console.error('Error reading ui-variant self-switch capability:', error);
    return NextResponse.json({ success: false, error: 'שגיאת שרת' }, { status: 500 });
  }
}
