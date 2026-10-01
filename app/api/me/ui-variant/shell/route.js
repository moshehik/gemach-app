import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildLegacyShellOverride } from '@/lib/designPrefsSchema';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// POST /api/me/ui-variant/shell — "האתר הישן" (האייקון הזמני בסרגל התפריט החדש, J04/R12).
//
// גוף: { value: 'legacy' } → עקיפה אישית: המעטפת (התפריט) חוזרת לישן לעובד הזה בלבד, בלי קשר להגדרת הארגון.
//      { value: null }     → ביטול העקיפה האישית של המעטפת (חוזרים להגדרת הארגון ui_variant_shell).
// כל ערך אחר — ובמיוחד 'a5' — נדחה ב-400. זה החריג המבוקר היחיד לכלל "uiVariants נקבעים רק ע"י הבעלים
// (scripts/set-ui-variant.js)": PUT /api/me/design-prefs ממשיך למחוק uiVariants; כאן מותר רק כיוון אחד,
// legacy. חזרה ל-A5 — רק דרך הסקריפט / הבעלים.
//
// מזוהה אך ורק לפי העוגייה (כמו design-prefs) — אין פרמטר id, עובד לא יכול לשנות לעובד אחר. הכתיבה היא
// prisma.employee.update רגיל → הרחבת ה-AuditLog ב-app/lib/prisma.js רושמת אותה (UPDATE Employee), כמו
// design-prefs; אין רישום ידני. בנוסף הנתיב מרענן את עוגיית designPrefs_<id> (המראה שה-layout קורא בטעינה
// מלאה) באותו פורמט שהלקוח כותב (app/lib/designPrefs.js writeDesignPrefsCookie), כדי שטעינה מלאה אחת
// (location.reload) כבר תציג את התפריט הישן — בלי לחכות ל-DesignPrefsSync.

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
    select: { id: true, themeColor: true, isActive: true }
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

export async function POST(request) {
  try {
    const session = await getSessionEmployee();
    if (!session) {
      return NextResponse.json({ success: false, error: 'לא מחובר/ת' }, { status: 401 });
    }
    const { employee, cookieKey, cookieStore } = session;
    if (!employee.isActive) {
      return NextResponse.json({ success: false, error: 'העובד/ת אינו פעיל/ה' }, { status: 403 });
    }

    let body = null;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'גוף הבקשה אינו JSON תקין' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.prototype.hasOwnProperty.call(body, 'value')) {
      return NextResponse.json({ success: false, error: "חסר השדה value (מותר רק 'legacy' או null)" }, { status: 400 });
    }
    if (body.value === 'a5') {
      return NextResponse.json({ success: false, error: 'אי אפשר להדליק את התפריט החדש דרך הנתיב הזה — רק הבעלים (scripts/set-ui-variant.js)' }, { status: 400 });
    }

    const built = buildLegacyShellOverride(employee.themeColor, body.value);
    if (!built.ok) {
      return NextResponse.json({ success: false, error: built.error }, { status: 400 });
    }

    if (built.changed) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { themeColor: built.serialized },
        select: { id: true },
      });
    }

    const res = NextResponse.json({
      success: true,
      employeeId: employee.id,
      shell: built.next.uiVariants ? (built.next.uiVariants.shell || null) : null,
      uiVariants: built.next.uiVariants || null,
      changed: built.changed,
    });
    // המפתח של העוגייה הוא ערך ה-auth_token (כך ה-layout קורא אותה: designPrefs_${authToken.value}).
    // Next מקודד את הערך (encodeURIComponent) בכתיבה ומפענח בקריאה — אותו פורמט כמו document.cookie בלקוח.
    try {
      const cookieName = `designPrefs_${cookieKey}`;
      res.cookies.set({
        name: cookieName,
        value: JSON.stringify(cookiePayloadFromPrefs(built.next, cookieStore.get(cookieName)?.value)),
        path: '/',
        sameSite: 'lax',
        maxAge: DESIGN_PREFS_COOKIE_MAX_AGE,
      });
    } catch (e) {
      // העוגייה היא רק מראה מהירה; בלי רענון שלה DesignPrefsSync ירענן אותה בטעינה הבאה.
      console.warn('ui-variant/shell: failed to refresh designPrefs cookie:', e?.message || e);
    }
    return res;
  } catch (error) {
    console.error('Error updating shell ui-variant override:', error);
    return NextResponse.json({ success: false, error: 'שגיאת שרת' }, { status: 500 });
  }
}
