// lib/aiGuide/access.js - הרשאות וזמינות של יעדים/דפים/משימות למשתמשת מסוימת. טהור (בלי DB/Next): מקבל הקשר שהשרת חישב
// (lib/aiGuide/serverContext.js) ומחליט מה מותר לעוזר להפנות אליו. עיקרון: כשל-סגור - לא ידוע = לא מוצג.
//
// הקשר (ctx): { logged, roleId, head, prog, perms:{ 'page:x':boolean }, settings:{key:value}, menuItemIds:Set<string>,
//               hubToolIds:Set<string>, rail:{ search, errorReport, oldSite, bell, shiftClock, user } }
// access: { gate:'head'|'prog', pageKey, setting:[key,value], loggedIn:true }. ערך setting שמתחיל ב-'!' = "שונה מ" (למשל ['nedarim_plus_enabled','!false']).

export function checkAccess(access, ctx) {
  if (!access) return true;
  const c = ctx || {};
  if (access.loggedIn && !c.logged) return false;
  if (access.gate === 'head' && !c.head) return false;
  if (access.gate === 'prog' && !c.prog) return false;
  if (access.pageKey) {
    const perms = c.perms || {};
    if (perms[access.pageKey] !== true) return false; // מפתח שלא נטען = סגור
  }
  if (access.setting) {
    const [key, want] = access.setting;
    const have = c.settings ? c.settings[key] : undefined;
    if (typeof want === 'string' && want.startsWith('!')) { if (have === want.slice(1)) return false; }
    else if (have !== want) return false;
  }
  return true;
}

/** כל מפתחות ההרשאה שהרישום משתמש בהם - לטעינה אחת של resolvePageAccess. */
export function collectPermissionKeys({ pages = [], targets = [], tasks = [] } = {}) {
  const keys = new Set();
  for (const x of [...pages, ...targets, ...tasks]) if (x && x.access && x.access.pageKey) keys.add(x.access.pageKey);
  return [...keys];
}

/** כללי נראות לאייקוני הסרגל, מתוך rail של עץ התפריט (הם אינם פריטי תפריט). */
export const RAIL_RULES = Object.freeze({
  'rail.brand': () => true,
  'rail.search': (rail) => !!(rail && rail.search && rail.search.show),
  'rail.error-report': (rail) => !!(rail && rail.errorReport && rail.errorReport.show),
  'rail.old-site': (rail) => !!(rail && rail.oldSite && rail.oldSite.show),
  'rail.bell': (rail) => !!(rail && rail.bell && rail.bell.show),
  'rail.shift-clock': (rail) => !!(rail && rail.shiftClock && rail.shiftClock.show),
  'rail.user': () => true,
  'rail.burger': () => true,
});

export function isPageAllowed(page, ctx) {
  return !!page && checkAccess(page.access, ctx);
}

/**
 * האם היעד זמין למשתמשת: פריט תפריט - לפי נוכחותו בעץ שלה; כלי ניהול - לפי הכלים המותרים; אייקון בסרגל - לפי rail; ואחרת לפי
 * ה-access של היעד ושל הדף שבו הוא נמצא. pagesByRoute: Map של נתיב -> רשומת דף (לבדיקת גישה לדף).
 */
export function isTargetAvailable(target, ctx, pagesByRoute) {
  if (!target) return false;
  const c = ctx || {};
  if (target.menuItem && !(c.menuItemIds && c.menuItemIds.has(target.menuItem))) return false;
  if (target.hubTool && !(c.hubToolIds && c.hubToolIds.has(target.hubTool))) return false;
  if (RAIL_RULES[target.id] && !RAIL_RULES[target.id](c.rail)) return false;
  if (!checkAccess(target.access, c)) return false;
  if (target.route && target.route !== '*' && pagesByRoute) {
    const page = pagesByRoute.get(target.route);
    if (page && !isPageAllowed(page, c)) return false;
  }
  if (target.parent && target.menuItem == null && target.hubTool == null) {
    // יעד שאין לו תנאי עצמאי יורש זמינות מהאב רק כשהאב הוא פריט תפריט (למשל reveal מתפריט): נבדק ב-knowledge.js
  }
  return true;
}
