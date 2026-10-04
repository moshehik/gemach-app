import { cookies, headers } from 'next/headers';
import prisma from './prisma';
import { readVerifiedSession } from '@/lib/auth';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { readSignedDesignPrefs } from './designPrefsCookie';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { resolveUiVariant, sanitizeUiVariants, UI_VARIANT_SETTING_KEY_LIST } from '@/lib/uiVariant';

// הכרעת "ישן / חדש" של מסך בתוך דף שרת (page.js) — לדפים שבוחרים בשרת בין Legacy* לחדש (פרופיל, מסך ניהול ראשי, נוכחות),
// כדי שהפניה בשרת (/employees/report -> /employees/attendance) תישאר הפניית שרת ושלא ירונדרו שתי הגרסאות.
//
// אותם קלטים בדיוק כמו app/layout.js (resolveUiVariants שם): עקיפה אישית מעוגיית designPrefs_<id> (חתומה, GQ-01b), הגדרות הארגון מ-getAllCachedSettings
// (מטמון 30 שנ' — בלי שאילתה נוספת ברוב הבקשות), ה-roleId מעוגיית auth_session המאומתת (ובלעדיה — אותה שאילתת roleId כמו ב-layout),
// וה-pathname מ-x-pathname. כך ההכרעה כאן זהה להכרעה של ה-layout באותה בקשה (useUiVariant בלקוח).
// הערה: דגל תצוגה בלבד — לא גבול הרשאות (ר' lib/uiVariant.js). ההרשאות נשארות בשערים של הדפים וה-API.

async function readRoleId(cookieStore, authToken) {
  if (!authToken || !authToken.value) return null;
  try {
    const session = readVerifiedSession(cookieStore);
    if (session && typeof session.r === 'number') return session.r;
  } catch (e) { /* נופלים לשאילתה */ }
  try {
    const parsedLegacy = /^\d+$/.test(String(authToken.value)) ? parseInt(authToken.value, 10) : NaN; // ספרות בלבד, כמו ב-layout
    const row = await prisma.employee.findFirst({
      where: { OR: [{ id: authToken.value }, ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])] },
      select: { roleId: true },
    });
    return row && typeof row.roleId === 'number' ? row.roleId : null;
  } catch (e) {
    return null; // שגיאת DB: בלי תפקיד -> ברירת המחדל 'legacy'
  }
}

/** @returns {Promise<'legacy'|'a5'>} */
export async function getRequestUiVariant(screen) {
  const cookieStore = await cookies();
  const authToken = getVerifiedAuthCookie(cookieStore);
  let userVariants;
  if (authToken && authToken.value) {
    // עוגייה חתומה בלבד (lib/designPrefsSig.js): חסרה / לא חתומה / מזויפת / של עובד אחר = אין עקיפה אישית.
    userVariants = sanitizeUiVariants(readSignedDesignPrefs(cookieStore, authToken.value)?.uiVariants);
  }
  const [settings, roleId] = await Promise.all([
    getAllCachedSettings()
      .then((all) => all.filter((s) => UI_VARIANT_SETTING_KEY_LIST.includes(s.key)))
      .catch(() => []),
    readRoleId(cookieStore, authToken),
  ]);
  const headersList = await headers();
  return resolveUiVariant(screen, { userVariants, settings, pathname: headersList.get('x-pathname') || '', roleId });
}
