// lib/orgIdentity.js - איזה גמ"ח מריץ את הקוד הזה. אותו קוד (main) נפרס לשני פרויקטי Vercel עם DB נפרד
// לכל אחד; ההבחנה היחידה בזמן ריצה היא הדומיין של הפרויקט (VERCEL_PROJECT_PRODUCTION_URL, גם ב-preview),
// כמו recordingsRootName ב-lib/driveBridgeServer.js. מודול טהור, נבדק ב-scripts/test_login_logic.mjs.
//
// שימוש כרגע: הפס העליון של דף הכניסה החדש (lib/loginFlow.js brandBar) - התגית "מכובד השכרת שמלות"
// מוצגת רק בגמ"ח הראשי. כל הגדרה עסקית אחרת ממשיכה לחיות ב-SystemSetting של כל גמ"ח, לא כאן.

export const ORG_MAIN = 'main';
export const ORG_NEVE_YAAKOV = 'neve-yaakov';

/** 'main' | 'neve-yaakov' לפי מחרוזת מארח/דומיין. ריק או לא מזוהה = הגמ"ח הראשי. */
export function detectOrgFromHost(host) {
  const h = String(host || '').toLowerCase();
  if (/neve|נווה/.test(h)) return ORG_NEVE_YAAKOV;
  return ORG_MAIN;
}

export function currentOrg(env = process.env) {
  if (env.GEMACH_ORG === ORG_NEVE_YAAKOV || env.GEMACH_ORG === ORG_MAIN) return env.GEMACH_ORG;
  return detectOrgFromHost(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || '');
}

export function isMainGemach(env = process.env) {
  return currentOrg(env) === ORG_MAIN;
}
