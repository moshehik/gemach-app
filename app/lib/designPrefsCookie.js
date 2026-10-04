import { DESIGN_PREFS_COOKIE_TTL_SECONDS, planDesignPrefsCookie, readDesignPrefsFromCookie } from '@/lib/designPrefsSig';

// הדבק של Next לעוגיית designPrefs_<id> החתומה (הליבה הטהורה: lib/designPrefsSig.js - שם הפורמט, ההחלטות והבדיקות).
// המפתח (key) הוא ערך עוגיית auth_token המאומתת (getVerifiedAuthCookie) - אותו מפתח שה-layout קורא איתו, והוא נכלל בחתימה.
// העוגייה httpOnly: אף קוד לקוח לא קורא אותה (ה-layout / uiVariantServer בשרת בלבד), והלקוח לא כותב אותה - רק השרת (routes).

export function designPrefsCookieName(key) {
  return `designPrefs_${key}`;
}

// ההעדפות מהעוגייה החתומה, או null ("אין עוגייה" = ברירות מחדל). לעולם לא זורק.
export function readSignedDesignPrefs(cookieStore, key) {
  try {
    if (!cookieStore || !key) return null;
    return readDesignPrefsFromCookie(cookieStore.get(designPrefsCookieName(key))?.value, key);
  } catch (e) {
    return null;
  }
}

// כותב / מוחק את העוגייה בתשובה (NextResponse) לפי מה שה-DB אומר (dbPrefs = ההעדפות השמורות ב-Employee.themeColor).
// מחזיר { action, rebuilt? } - ה-GET מדווח את rebuilt ללקוח. כשל בכתיבה לא מפיל את הבקשה (העוגייה היא מראה מהיר בלבד).
export function syncDesignPrefsCookie(res, cookieStore, key, dbPrefs) {
  try {
    const name = designPrefsCookieName(key);
    const plan = planDesignPrefsCookie(cookieStore?.get(name)?.value, key, dbPrefs);
    if (plan.action === 'set') {
      res.cookies.set({
        name,
        value: plan.value,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: DESIGN_PREFS_COOKIE_TTL_SECONDS,
      });
    } else if (plan.action === 'delete') {
      res.cookies.set({ name, value: '', httpOnly: true, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
    }
    return plan;
  } catch (e) {
    console.warn('designPrefs cookie sync failed:', e?.message || e); // בלי ערכים / סוד בלוג
    return { action: 'none' };
  }
}
