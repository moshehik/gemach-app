// lib/menu/buildMenuTree.js — עץ התפריט החדש (A5, עיצוב "תפריט-חדש.html" שאושר ב-1.10.2026).
//
// מודול טהור: בלי React, בלי Next, בלי prisma, בלי `@/` — נטען גם ב-node רגיל (scripts/test_menu_logic.mjs).
// הפלט הוא JSON נקי (בלי פונקציות), כדי שאפשר יהיה לחשב אותו בשרת (app/layout.js או /api/a5/boot)
// ולשלוח לרכיב הלקוח שיצייר אותו.
//
// מקור אמת אחד לנראות: הפריטים שקיימים בתפריט הישן נשפטים לפי `buildNavGroups(flags)` מ-navConfig.js
// (אותו חישוב דגלים שמבצע app/layout.js) — כאן לא מומצא כלל הרשאה חדש. הפריטים שאין להם שורה בתפריט
// הישן (תתי-הפריטים של "ניהול", פאנל המשתמש, הפעמון) נשפטים לפי אותם דגלים שכבר קיימים ב-layout
// (showAdminTab = הנהלה ראשית/מתכנת או אורח כשההתחברות לא חובה; isProgrammer; hideInternalMessaging;
// hideErrorReporting) ולפי הגדרות SystemSetting קיימות. אין כאן מערך roleId חדש.
//
// מה שהבעלים הסיר מהתפריט (R01 R02 R03 R04 R11) לא נפלט כאן בכלל. התפריט הישן (AppShell.js +
// navConfig.js) לא נגע, ולכן משתמש בוריאנט 'legacy' ממשיך לראות אותם — ההפרדה היא הדגל ui_variant_shell.
// החלטת הבעלים 1.10.2026 (מחליפה את R09/R10): "משלוחים" ו"זיכויים וחובות" חוזרים לתפריט — כתת-פריטים של
// "ניהול" (לא תחת "הזמנה" ולא בתוך דף הכספים), באותה נראות בדיוק כמו בתפריט הישן: משלוחים רק כש-
// enable_deliveries==='true' ∧ page:deliveries (בגמ"ח הראשי ההגדרה כבויה → השורה לא קיימת שם), זיכויים
// לפי page:refunds. למנהלת סניף הם נחשבים תת-פריט מותר, כלומר "ניהול" מוצג לה גם בזכותם (D10).
//
// "לוז" (page:schedule) היא לשונית בסרגל (אחרי "בית", כמו בעיצוב המאושר) עם קישור /schedule, כשל-סגור על ההרשאה
// (סגורה כברירת מחדל; עד שענף הלוז ימוזג המפתח אינו בקטלוג ו-resolvePageAccess מחזיר false לכולם).
// כשאין הרשאה / הדף לא קיים — הלשונית מוצגת כ"בקרוב" (soon:true, בלי href, לא קישור ולא ניתנת למיקוד), לעולם לא מובילה לשום מקום.
// החלטת הבעלים 1.10.2026: פריטים שמופיעים בעיצוב כ"עדיין לא קיים באתר" (בדיקת מלאי; עד 2.10.2026 גם שינויים אחרונים
// וחיפוש מתקדם) מוגדרים עם notBuilt:true ומוצגים כשורה כבויה "בקרוב" (kind:'soon', בלי href ובלי פעולה) עד שיתקבל
// דף אמיתי (ctx.available[id] === true) — ואז הם שורה רגילה.

import { buildNavGroups } from '../../app/components/navConfig.js';
import { hebrewVersionStamp } from '../hebrewStamp.js';
import { getIsraelTodayKey, addDaysToDateKey } from '../hebrewDate.js';

export const MENU_TREE_VERSION = 1;

// תוויות תפקיד כמו ב-/api/a5/boot (roleId: 0 הנהלה ראשית, 1 מנהלת סניף, 2 מתכנת; אחר = עובדת).
export const ROLE_LABELS = Object.freeze({ 0: 'הנהלה ראשית', 1: 'מנהלת סניף', 2: 'מתכנת' });
export const DEFAULT_ROLE_LABEL = 'עובדת';
export const DEFAULT_BRAND_NAME = 'גמ"ח שמלות';

// הפריטים שהוסרו בהחלטת הבעלים (DECISIONS-תפריט.md). לתיעוד ולבדיקות: העץ החדש לעולם לא מכיל אותם.
export const REMOVED_ITEMS = Object.freeze({
  R01: { label: 'הצמדת קיצורים לסרגל', legacyWhere: 'app/components/AppShell.js (gemachPinnedNav, כפתור הסיכה)' },
  R02: { label: 'חצי אחורה / קדימה ליד הלוגו', legacyWhere: 'app/components/AppShell.js (router.back / router.forward)', movedTo: 'פאנל החיפוש (lib/menu/navHistory.js)' },
  R03: { label: 'ריענון וניקוי פילטרים', legacyWhere: 'app/components/AppShell.js (handleRefresh)' },
  R04: { label: 'מתג ערכת נושא', legacyWhere: 'app/components/ThemeToggle.js' },
  // החלטת הבעלים 4.10.2026 (answers-admin-cards: 'תפריט "ניהול": קיצורים "ניהול אתר", "הרשאות" ו"ניהול מחירון"'): שלושת הקיצורים
  // חזרו לתפריט כתתי-פריטים של "ניהול" (ר' RESTORED_ITEMS.R11a-R11c); ברשימת ההסרה נשאר רק דוח הנוכחות.
  R11: { label: 'דוח נוכחות (כקבוצה בניהול)', legacyWhere: 'כרטיסי /admin (app/admin/page.js)', hrefs: ['/employees/report'] },
});
export const REMOVED_HREFS = Object.freeze(
  Object.values(REMOVED_ITEMS).flatMap((r) => r.hrefs || [])
);
// הוסרו בסבב ההחלטות הראשון (R09/R10) והוחזרו בהחלטת הבעלים 1.10.2026 — כתת-פריטים של "ניהול". לתיעוד ולבדיקות.
export const RESTORED_ITEMS = Object.freeze({
  R09: { id: 'ad-deliveries', label: 'משלוחים', href: '/deliveries', visibleWhen: "enable_deliveries==='true' ∧ page:deliveries (כמו navConfig.js showDeliveries)" },
  R10: { id: 'ad-refunds', label: 'זיכויים וחובות', href: '/refunds', visibleWhen: 'page:refunds (כמו navConfig.js showRefundsTab)' },
  // החלטת הבעלים 4.10.2026 — חלק מ-R11 חזר: קיצורים בתפריט "ניהול", כמו בעיצוב המאושר של מסך הניהול (ניהול-ראשי-כרטיסים.html).
  R11a: { id: 'ad-site', label: 'ניהול אתר', href: '/admin/site', visibleWhen: 'מתכנת בלבד (gate prog; הדף: app/admin/site/layout.js DEVELOPER_ONLY_ROLES)' },
  R11b: { id: 'ad-perms', label: 'הרשאות', href: '/admin/permissions', visibleWhen: 'הנהלה ראשית / מתכנת (gate head, כמו app/admin/layout.js)' },
  R11c: { id: 'ad-pricelist', label: 'ניהול מחירון', href: '/dashboard/pricelist', visibleWhen: 'הנהלה ראשית / מתכנת (gate head, כמו app/dashboard/pricelist/layout.js)' },
});

// פריטים שקיימים בעיצוב אבל אין להם עדיין דף באתר (PENDING בעיצוב). מוצגים כשורה כבויה "בקרוב" עד שדף ייבנה.
// "שינויים אחרונים" ו"חיפוש מתקדם" הפסיקו להיות כאלה (החלטת הבעלים 2.10.2026): הם פותחים את דף החיפוש הראשי עם פרמטר.
export const NOT_BUILT_ITEM_IDS = Object.freeze(['order-stock']);

// --- הגדרת כל השורות, פעם אחת (כמו D בעיצוב) ------------------------------------------------
// legacy: ה-href בתפריט הישן (navConfig.js) שקובע את הנראות; gate: 'head' = flags.showAdminTab,
// 'prog' = מתכנת, 'managementMessages' = הגדרת management_messages; logged: רק למחובר; guest: רק לאורח;
// notBuilt: אין דף — מוצג כשורה כבויה "בקרוב"; action: פעולה בלקוח במקום ניווט; temporary: מסומן "זמני" בעיצוב.
const ITEM_DEFS = {
  // בית
  'home-search': { label: 'חיפוש כללי', icon: 'search', href: '/', legacy: '/', tip: 'חיפוש לקוח, הזמנה או פריט' },
  // החלטת הבעלים 2.10.2026: כל פריטי "בית" פותחים את דף החיפוש הראשי ('/') עם פרמטר (ר' parseHomeParams ב-homeLogic.js):
  // scope=<קטגוריה> = כותרת "<קטגוריה> - מה תרצי לחפש?" וחיפוש רק בה; adv=1 = ישר לשלב החיפוש המתקדם;
  // recent=changes = רשימת '@' (האחרונים של העובדת). legacy נשאר ה-href הישן ולכן קובע את הנראות בדיוק כמו קודם;
  // fallbackHref / homeOnly: ui_variant_shell ו-ui_variant_home הם דגלים עצמאיים. כשדף הבית אינו 'a5' (LegacyHome מתעלם מהפרמטרים)
  // הקישורים חוזרים ל-href הישן, ו"שינויים אחרונים" / "חיפוש מתקדם" חוזרים להיות שורות "בקרוב" (ctx.homeA5).
  // match = העמוד הישן של הקטגוריה — הפריט ממשיך להיות "נוכחי" כשהעובדת נמצאת בו (findActive).
  'recent-orders': { label: 'הזמנות', icon: 'file', href: '/?scope=orders', legacy: '/orders', match: '/orders', fallbackHref: '/orders' },
  'recent-customers': { label: 'לקוחות', icon: 'user', href: '/?scope=customers', legacy: '/customers', match: '/customers', fallbackHref: '/customers' },
  'recent-rentals': { label: 'השכרות', icon: 'bag', href: '/?scope=rentals', legacy: '/rentals#rented', match: '/rentals#rented', fallbackHref: '/rentals#rented' },
  'recent-returns': { label: 'החזרות', icon: 'undo', href: '/?scope=returns', legacy: '/rentals#returned', match: '/rentals#returned', fallbackHref: '/rentals#returned' },
  'recent-alterations': { label: 'תיקונים', icon: 'scissors', href: '/?scope=alterations', legacy: '/alterations', match: '/alterations', fallbackHref: '/alterations' },
  'recent-all': { label: 'שינויים אחרונים', icon: 'sn-history', homeOnly: true, href: '/?recent=changes', tip: 'האחרונים שפתחתי — כמו הקלדת @ בחיפוש' },
  // legacyAny: מוצג כשמותר לפחות עמוד אחד שהחיפוש המתקדם יכול לעבוד עליו (אותם תחומים כמו visibleFoci ב-homeAdvConfig.js).
  'home-adv': { label: 'חיפוש מתקדם', icon: 'sliders', homeOnly: true, href: '/?adv=1', legacyAny: ['/customers', '/orders', '/rentals#rented', '/rentals#returned', '/alterations', '/deliveries', '/dashboard/dresses', '/employees'] },
  // ניהול
  'ad-models': { label: 'דגמים', icon: 'dress', href: '/dashboard/dresses', legacy: '/dashboard/dresses', tip: 'מוצג לכל מי שיש לה הרשאת קטלוג דגמים (page:dresses_catalog)' },
  'ad-staff': { label: 'עובדים', icon: 'users', href: '/employees', legacy: '/employees', tip: 'עובדים ונוכחות' },
  'finance': { label: 'כספים', icon: 'wallet', href: '/dashboard', gate: 'head', tip: 'סיכום כספי' },
  // החלטת הבעלים 1.10.2026: זיכויים ומשלוחים כתת-פריטי "ניהול", באותה נראות כמו בתפריט הישן (navConfig.js).
  'ad-refunds': { label: 'זיכויים וחובות', icon: 'wallet', href: '/refunds', legacy: '/refunds', tip: 'מוצג לפי הרשאת זיכויים וחובות (page:refunds)' },
  'ad-deliveries': { label: 'משלוחים', icon: 'box', href: '/deliveries', legacy: '/deliveries', tip: 'מוצג רק כשמשלוחים מופעלים בהגדרות (enable_deliveries) ויש הרשאת משלוחים (page:deliveries)' },
  'ad-settings': { label: 'הגדרות', icon: 'gear', href: '/admin/settings', gate: 'head' },
  // קיצורים מהעיצוב המאושר של מסך הניהול (החלטת הבעלים 4.10.2026). "ניהול אתר" = המסך הישן /admin/site, למתכנת בלבד.
  'ad-site': { label: 'ניהול אתר', icon: 'sliders', href: '/admin/site', gate: 'prog', tip: 'מתכנת בלבד' },
  'ad-perms': { label: 'הרשאות', icon: 'lock', href: '/admin/permissions', gate: 'head' },
  'ad-pricelist': { label: 'ניהול מחירון', icon: 'tag', href: '/dashboard/pricelist', gate: 'head' },
  'ad-stats': { label: 'סטטיסטיקה', icon: 'sn-chart', href: '/admin/statistics', gate: 'head' },
  'ad-info': { label: 'מידע / היסטוריה', icon: 'info', href: '/admin/data-history', gate: 'head', tip: 'היסטוריית נתונים ושינויים' },
  // הזמנה
  'order-new': { label: 'הזמנה חדשה', icon: 'plus', href: '/orders/new', legacy: '/orders/new' },
  'order-kiosk': { label: 'עמדת לקוח', icon: 'eye', href: '/customer-interface', legacy: '/customer-interface', tip: 'המסך שהלקוחה ממלאת בעצמה' },
  // בדיקת מלאי (/stock-check, 2.10.2026): הדף קיים — app/layout.js מסמן available['order-stock']=true. הנראות לפי
  // הרשאת page:orders (legacy '/orders', כמו "הזמנות"): החלטת הבעלים GQ-06a — אותו שער כמו דפי ההזמנות, בלי פריט חדש.
  // notBuilt נשאר כדי שקורא שלא סימן available (למשל /api/a5/boot) יציג "בקרוב" ולא קישור לדף שאולי אינו פרוס אצלו.
  'order-stock': { label: 'בדיקת מלאי', icon: 'sn-inv', href: '/stock-check', legacy: '/orders', notBuilt: true, tip: 'אילו דגמים פנויים בתאריך, לפי דגם ו/או מידה' },
  // פאנל המשתמש
  'u-profile': { label: 'הפרופיל שלי', icon: 'user', href: '/profile', logged: true },
  'u-punch': { label: 'שעון נוכחות', icon: 'clock', href: '/punch-clock', logged: true },
  'u-hours': { label: 'שעות העבודה שלי', icon: 'list', href: '/my-hours', logged: true },
  // בעיצוב המאושר (תפריט-חדש.html, u-display עם logged:1) אורח רואה רק "היכנס למערכת".
  // 'u-display' ("עיצוב ותצוגה") הוסר מתפריט הפרופיל לפי בקשת הבעלים (4.10.2026); הדף /display-settings נשאר קיים.
  'u-hist': { label: 'היסטוריית הודעות מערכת', icon: 'note', action: 'system-messages-history', gate: 'prog', logged: true, tip: 'מתכנת בלבד' },
  'u-logout': { label: 'התנתקות', icon: 'logout', action: 'logout', danger: true, logged: true, tip: 'בודקת קודם אם יש משפחות באיחור, ואז יוצאת' },
  'u-login': { label: 'היכנס למערכת', icon: 'user', action: 'login', guest: true },
  // לשונית "לוז" (ה-href מחושב בזמן הבנייה: /schedule?date=<היום / מחר בישראל>)
  'sched-today': { label: 'היום', icon: 'cal', logged: true, tip: 'לוח זמנים של היום', schedDay: 0 },
  'sched-tomorrow': { label: 'מחר', icon: 'arrl', logged: true, tip: 'לוח זמנים של מחר', schedDay: 1 },
  // פאנל הפעמון
  // MS-08: כשההודעות הפנימיות מוסתרות (hide_internal_messaging) אין מרכז הודעות - השורה נעלמת (gate: internalMessaging), הפעמון עצמו נשאר.
  'n-center': { label: 'פתח מרכז הודעות', icon: 'msg', href: '/messages', logged: true, pageKey: 'page:messages', gate: 'internalMessaging' },
  'n-manager-message': { label: 'הודעה למנהל', icon: 'msg', action: 'message-to-manager', logged: true, gate: 'managementMessages', tip: 'נשלחת כהודעה להנהלה (כמו הטופס בדף ההודעות)' },
};

// הלשוניות, לפי הסדר בעיצוב. '-' = מפריד, { h } = כותרת קבוצה.
const TABS = [
  { id: 'home', label: 'בית', icon: 'home', href: '/', legacy: '/', items: ['home-search', '-', 'recent-orders', 'recent-customers', 'recent-rentals', 'recent-returns', 'recent-alterations', 'recent-all', '-', 'home-adv'] },
  // לוז יומי (/schedule, PR 2.C): לשונית אחרי "בית" כמו בעיצוב. strictPageKey: גם הנהלה ראשית רואה אותה כפעילה רק כשההרשאה נטענה
  // ואומרת true (הדף אולי עוד לא קיים בפריסה); בכל מצב אחר — "בקרוב" (soon), בלי קישור.
  // תפריט הריחוף של הלשונית (תפריט-חדש.html: sched-today / sched-tomorrow; החלטת הבעלים SCH-S01 "להכניס" גוברת על P01 "בהמשך"):
  // "היום" ו"מחר" = קישורים ל-/schedule?date=<תאריך> לפי שעון ישראל (lib/hebrewDate.js), לא לפי שעון הדפדפן; ctx.todayKey לבדיקות.
  { id: 'sched', label: 'לוז', icon: 'clock', href: '/schedule', logged: true, pageKey: 'page:schedule', strictPageKey: true, tip: 'לוז יומי — היום / מחר', soonTip: 'לוז יומי — בקרוב', items: ['sched-today', 'sched-tomorrow'] },
  { id: 'month', label: 'לוח חודשי', icon: 'cal', href: '/board', legacy: '/board' },
  { id: 'admin', label: 'ניהול', icon: 'shield', href: '/admin', gate: 'head', items: ['ad-models', 'ad-staff', 'finance', 'ad-refunds', 'ad-deliveries', '-', 'ad-settings', 'ad-site', 'ad-perms', 'ad-pricelist', 'ad-stats', 'ad-info'] },
  { id: 'order', label: 'הזמנה', icon: 'plus', href: '/orders/new', legacy: '/orders/new', items: ['order-new', 'order-kiosk', 'order-stock'] },
];
const USER_ITEMS_LOGGED = ['u-profile', 'u-punch', 'u-hours', 'u-hist', '-', 'u-logout'];
const USER_ITEMS_GUEST = ['u-login'];
const BELL_ROWS = ['n-center', 'n-manager-message'];

export const ITEM_IDS = Object.freeze(Object.keys(ITEM_DEFS));
export const TAB_IDS = Object.freeze(TABS.map((t) => t.id));

// --- עזרי הגדרות ------------------------------------------------------------------------
// settings יכול להיות מערך שורות { key, value } (getAllCachedSettings) או מפה { key: value }.
export function settingsToMap(settings) {
  const out = {};
  if (!settings) return out;
  if (Array.isArray(settings)) {
    for (const row of settings) {
      if (row && typeof row.key === 'string') out[row.key] = row.value;
    }
    return out;
  }
  if (typeof settings === 'object') {
    for (const k of Object.keys(settings)) out[k] = settings[k];
  }
  return out;
}
// קפדני בדיוק כמו app/layout.js ו-app/api/notifications/route.js (`value === 'true'`): ערך כמו ' True'
// לא נחשב פעיל, אחרת התפריט יציג שורה (למשל "הודעה למנהל") שהשרת מסרב לה.
const settingIs = (map, key, expected) => typeof map[key] === 'string' && map[key] === expected;

function normalizeRoleId(roleId) {
  if (typeof roleId === 'number' && Number.isInteger(roleId)) return roleId;
  if (typeof roleId === 'string' && /^\d+$/.test(roleId)) return parseInt(roleId, 10);
  return null;
}

// --- הדגלים של התפריט הישן, מחושבים באותם כללים בדיוק כמו app/layout.js ו-app/api/a5/boot ----------
// (שני המקומות האלה עדיין מחזיקים עותק משלהם; תוכנית הבנייה מציעה שיקראו לכאן כדי שיישאר עותק אחד.)
// permissions: מפה { 'page:x': boolean } כפי ש-resolvePageAccess מחזירה, או null כשלא נטענה.
//
// חוזה הקלט (מה הקורא חייב לטעון): ctx.permissions צריך להכיל את *כל* המפתחות שלמטה —
//   resolvePageAccess(roleId, token, NAV_PAGE_KEYS). מפתח שחסר במפה נחשב "לא ידוע":
//   - לעמודים שיש להם שורה בתפריט הישן (navConfig.js) — אותה התנהגות כמו app/layout.js (ר' gated / pageVisible).
//   - לשורה עם pageKey ("פתח מרכז הודעות" = page:messages, "לוז" = page:schedule) — כשל-סגור: עובדת/מנהלת
//     סניף לא רואה את השורה עד שההרשאה נטענה ואומרת true; הנהלה ראשית/מתכנת רואים כשהמפתח לא נטען (resolvePageAccess
//     מחזיר להם true תמיד), אבל ערך מפורש false מסתיר גם להם. page:schedule: עד שענף הלוז ימוזג המפתח אינו
//     בקטלוג (lib/permissionsMetadata.js) ו-resolvePageAccess מחזיר false לכולם — ולכן "לוז" מוסתר לכולם.
// app/layout.js מייבא את NAV_PAGE_KEYS מכאן (מ-1.10.2026) ומעביר גם את ההגדרות management_messages, gmach_name,
// gmach_subtitle, BRAND_LOGO (רק !!value) ל-buildMenuTree (menuTree שנבנה ב-app/layout.js). /api/a5/boot עדיין מחזיק עותק משלו.
export const NAV_PAGE_KEYS = Object.freeze(['page:refunds', 'page:dresses_catalog', 'page:board', 'page:orders', 'page:orders_new', 'page:rentals', 'page:customers', 'page:deliveries', 'page:alterations', 'page:messages', 'page:schedule']);
/** המפתחות שהעץ בודק דרך pageKey (לא דרך התפריט הישן). חובה לטעון אותם — אחרת השורה מוסתרת (כשל-סגור). */
export const MENU_PAGE_KEYS = Object.freeze(['page:messages', 'page:schedule']);

export function deriveLegacyFlags({ logged, roleId, permissions, settings } = {}) {
  const map = settingsToMap(settings);
  const rid = normalizeRoleId(roleId);
  const isLogged = !!logged;
  const requireLogin = settingIs(map, 'require_login', 'true');
  const open = !requireLogin;
  const isHeadManagement = isLogged && (rid === 0 || rid === 2);
  const isProgrammer = isLogged && rid === 2;
  const perms = permissions && typeof permissions === 'object' ? permissions : null;
  // עמוד "סגור" (ברירת מחדל הנהלה בלבד): מחובר → שורת הרשאה, ואם לא נטענה → הנהלה; אורח → רק במצב פתוח.
  const gated = (key) => (isLogged ? (perms ? !!perms[key] : isHeadManagement) : open);
  // עמוד "פתוח": מוצג אלא אם שורת הרשאה אומרת אחרת (בלי הרשאות טעונות = מוצג).
  const pageVisible = (key) => (isLogged && perms ? !!perms[key] : true);
  const hideInternalMessaging = settingIs(map, 'hide_internal_messaging', 'true');
  return {
    showAdminTab: isLogged ? isHeadManagement : open,
    showEmployeesTab: isLogged ? isHeadManagement : open,
    showRefundsTab: gated('page:refunds'),
    showDressesTab: gated('page:dresses_catalog'),
    showBoardTab: gated('page:board'),
    enableAlterations: !settingIs(map, 'enable_alterations', 'false') && pageVisible('page:alterations'),
    showMessages: !hideInternalMessaging,
    showDeliveries: settingIs(map, 'enable_deliveries', 'true') && pageVisible('page:deliveries'),
    showOrdersNew: pageVisible('page:orders') && pageVisible('page:orders_new'),
    showOrders: pageVisible('page:orders'),
    showRentals: pageVisible('page:rentals'),
    showCustomers: pageVisible('page:customers'),
    // דגלים שה-layout מעביר ל-AppShell מחוץ ל-navGroups:
    isHeadManagement,
    isProgrammer,
    hideInternalMessaging,
    hideErrorReporting: settingIs(map, 'hide_error_reporting', 'true'),
    requireLogin,
    isAuthenticated: isLogged,
  };
}

// --- בניית העץ ---------------------------------------------------------------------------
function userInitials(user) {
  const a = user && user.firstName ? String(user.firstName).charAt(0) : '';
  const b = user && user.lastName ? String(user.lastName).charAt(0) : '';
  return (a + b) || 'U';
}
function userName(user) {
  if (!user) return '';
  if (user.fullName) return String(user.fullName);
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function emitItem(id, def, extra) {
  const out = { id, kind: def.action ? 'action' : 'link', label: def.label, icon: def.icon };
  if (def.href) out.href = def.href;
  if (def.action) out.action = def.action;
  if (def.tip) out.tip = def.tip;
  if (def.danger) out.danger = true;
  if (def.temporary) out.temporary = true;
  if (def.match) out.match = def.match;
  return Object.assign(out, extra || {});
}

// שורה "בקרוב": אותו מראה כמו שורה רגילה אבל בלי href ובלי action — הרכיב מצייר אותה כשורה כבויה שאי אפשר ללחוץ עליה.
function emitSoon(id, def) {
  const out = { id, kind: 'soon', label: def.label, icon: def.icon };
  if (def.tip) out.tip = def.tip;
  return out;
}

/**
 * בונה את עץ התפריט החדש.
 * @param {object} ctx
 * @param {object|null} ctx.user        העובד המחובר ({ id, firstName, lastName, fullName?, roleId }) או null לאורח
 * @param {number|null} [ctx.roleId]    תפקיד (ברירת מחדל user.roleId)
 * @param {object|null} [ctx.permissions] { 'page:x': boolean } מ-resolvePageAccess (null = לא נטען)
 * @param {Array|object} [ctx.settings] שורות SystemSetting או מפה
 * @param {object} [ctx.flags]          דגלי התפריט הישן כפי ש-app/layout.js חישב (אם חסר — deriveLegacyFlags)
 * @param {object} [ctx.org]            { id?: 1|2 } — מידע בלבד; ההתנהגות נקבעת רק מההגדרות
 * @param {boolean} [ctx.homeA5]        דף הבית החדש פעיל (uiVariants.home === 'a5'). ברירת מחדל false: קישורי "בית" הישנים (בלי פרמטרים)
 * @param {object} [ctx.available]      { [itemId]: true } — מסמן פריט "עדיין לא קיים" כזמין (דף נבנה)
 * @param {object} [ctx.version]        { version, date } מ-app/version.json (לטולטיפ הלוגו)
 * @param {object} [ctx.status]         { activeShift?: boolean, unreadCount?: number } נתוני זמן-ריצה אופציונליים
 */
export function buildMenuTree(ctx = {}) {
  const c = ctx || {};
  const settings = settingsToMap(c.settings);
  const user = c.user && typeof c.user === 'object' ? c.user : null;
  const logged = !!(user && user.id);
  const roleId = normalizeRoleId(c.roleId !== undefined ? c.roleId : (user ? user.roleId : null));
  // דגל שהועבר כ-undefined לא דורס את הנגזר (למשל { hideInternalMessaging: undefined }).
  const givenFlags = c.flags && typeof c.flags === 'object' ? Object.fromEntries(Object.entries(c.flags).filter(([, v]) => v !== undefined)) : null;
  const flags = givenFlags
    ? { ...deriveLegacyFlags({ logged, roleId, permissions: c.permissions, settings }), ...givenFlags }
    : deriveLegacyFlags({ logged, roleId, permissions: c.permissions, settings });
  const homeA5 = c.homeA5 === true;
  const available = c.available && typeof c.available === 'object' ? c.available : {};
  const perms = c.permissions && typeof c.permissions === 'object' ? c.permissions : null;
  // "היום" לפי שעון ישראל (לא לפי אזור הזמן של השרת/הדפדפן); ctx.todayKey = דריסה לבדיקות
  const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(String(c.todayKey || '')) ? c.todayKey : getIsraelTodayKey();

  // מקור האמת לנראות של כל מה שיש לו שורה בתפריט הישן.
  const legacyGroups = buildNavGroups(flags);
  const legacyHrefs = new Set(legacyGroups.flatMap((g) => g.items.map((i) => i.href)));

  const head = !!flags.showAdminTab;
  const prog = logged && roleId === 2;
  const msgs = !flags.hideInternalMessaging;
  const managementMessages = settingIs(settings, 'management_messages', 'true');

  const allowed = (def, id) => {
    if (def.notBuilt && available[id] !== true) return false;
    if (def.logged && !logged) return false;
    if (def.guest && logged) return false;
    if (def.legacy !== undefined && !legacyHrefs.has(def.legacy)) return false;
    if (def.legacyAny && !def.legacyAny.some((h) => legacyHrefs.has(h))) return false;
    if (def.gate === 'head' && !head) return false;
    if (def.gate === 'prog' && !prog) return false;
    if (def.gate === 'managementMessages' && !(msgs && managementMessages)) return false;
    if (def.gate === 'internalMessaging' && !msgs) return false;
    // שורה שמובילה לעמוד עם הרשאת page:* שאינה בתפריט הישן (page:messages — סגור כברירת מחדל,
    // lib/permissionsMetadata.js). כשל-סגור: בלי מידע הרשאה (permissions=null או המפתח לא נטען) מוצג רק
    // להנהלה ראשית/מתכנת (שלהם resolvePageAccess מחזיר true תמיד); לכל השאר רק כשההרשאה נטענה ואומרת true.
    // strictPageKey (לוז): בלי מידע הרשאה מוסתר לכולם, גם להנהלה — הדף עצמו אולי עוד לא קיים.
    if (def.pageKey) {
      const known = !!perms && Object.prototype.hasOwnProperty.call(perms, def.pageKey);
      if (known) { if (perms[def.pageKey] !== true) return false; } else if (def.strictPageKey || !flags.isHeadManagement) return false;
    }
    return true;
  };

  // כמו resolve() בעיצוב: מסנן, ומוריד מפרידים/כותרות מיותמים.
  const resolveList = (list) => {
    const out = [];
    for (const x of list) {
      if (x === '-') { out.push({ kind: 'separator' }); continue; }
      if (x && typeof x === 'object' && x.h) { out.push({ kind: 'heading', label: x.h }); continue; }
      let def = ITEM_DEFS[x];
      if (def && !homeA5) {
        if (def.homeOnly) { if (allowed({ ...def, homeOnly: false, notBuilt: false, legacyAny: undefined }, x)) out.push(emitSoon(x, def)); continue; }
        if (def.fallbackHref) def = { ...def, href: def.fallbackHref, match: undefined };
      }
      if (!def || !allowed(def.notBuilt ? { ...def, notBuilt: false } : def, x)) continue;
      // פריט שעדיין אין לו דף: שורה כבויה "בקרוב" (לא קישור, לא פעולה) במקום להסתיר אותו.
      // "היום"/"מחר": מילת יחס (today/tomorrow) שהדף מפענח לפי שעון ישראל של השרת - לא תאריך שחושב פעם אחת בבניית
      // ה-layout ומתיישן אחרי חצות. match = התאריך המוחלט של רגע הבנייה, רק כדי שהשורה תודגש גם כשהכתובת היא ISO.
      if (def.schedDay !== undefined) def = { ...def, href: '/schedule?date=' + (def.schedDay ? 'tomorrow' : 'today'), match: '/schedule?date=' + addDaysToDateKey(todayKey, def.schedDay) };
      out.push(def.notBuilt && available[x] !== true ? emitSoon(x, def) : emitItem(x, def));
    }
    const t = [];
    out.forEach((x, i) => {
      const isSep = x.kind === 'separator' || x.kind === 'heading';
      if (!isSep) { t.push(x); return; }
      const nxt = out[i + 1];
      const nxtReal = nxt && nxt.kind !== 'separator' && nxt.kind !== 'heading';
      if (x.kind === 'heading') { if (nxtReal) t.push(x); return; }
      const prev = t[t.length - 1];
      if (prev && prev.kind !== 'separator' && prev.kind !== 'heading' && nxt && nxt.kind !== 'separator') t.push(x);
    });
    while (t.length && t[t.length - 1].kind === 'separator') t.pop();
    return t;
  };

  const tabs = [];
  for (const tab of TABS) {
    if (tab.notBuilt && available[tab.id] !== true) continue;
    if (tab.pageKey) {
      // לשונית עם הרשאת page:* (לוז): פעילה רק כש-allowed אומר true; אחרת "בקרוב" (בלי href, לא קישור).
      const live = allowed(tab, tab.id);
      tabs.push(live
        ? { id: tab.id, label: tab.label, icon: tab.icon, href: tab.href, items: tab.items ? resolveList(tab.items) : [] }
        : { id: tab.id, label: tab.label, icon: tab.icon, href: null, items: [], soon: true, ...(tab.soonTip ? { tip: tab.soonTip } : {}) });
      continue;
    }
    const items = tab.items ? resolveList(tab.items) : [];
    const real = items.filter((x) => x.kind === 'link' || x.kind === 'action');
    const tabAllowed = tab.legacy !== undefined ? legacyHrefs.has(tab.legacy) : (tab.gate === 'head' ? head : true);
    if (tab.items && real.length === 0) continue; // לשונית עם תפריט ריק לא מוצגת (D10)
    if (!tab.items && !tabAllowed) continue;
    const out = { id: tab.id, label: tab.label, icon: tab.icon, href: tabAllowed ? tab.href : null, items };
    // ללשונית שהמשתמשת לא רשאית לפתוח את דף הבסיס שלה (למשל מנהלת סניף ב"ניהול") אין href — הלחיצה פותחת את התפריט.
    if (!tabAllowed && real.length) out.opensMenuOnly = true;
    tabs.push(out);
  }

  const userItems = resolveList(logged ? USER_ITEMS_LOGGED : USER_ITEMS_GUEST);
  const bellRows = resolveList(BELL_ROWS);
  // הפעמון לא קשור להודעות בין עובדים (החלטת בעלים 2026-10-02): מוצג לכל משתמש מחובר גם כש-hide_internal_messaging פעיל.
  // רק שורת "הודעה למנהל" בתוכו נשארת תלויה ב-msgs && management_messages (gate למעלה).
  const showBell = logged;
  const status = c.status && typeof c.status === 'object' ? c.status : {};

  const brandName = typeof settings.gmach_name === 'string' && settings.gmach_name.trim() ? settings.gmach_name.trim() : DEFAULT_BRAND_NAME;
  const brandSubtitle = typeof settings.gmach_subtitle === 'string' ? settings.gmach_subtitle.trim() : '';
  const ver = c.version && typeof c.version === 'object' ? c.version : null;
  // תאריך הגרסה מוצג תמיד כתאריך עברי (כלל: אף תאריך לועזי לא מוצג בממשק); שעה נשארת. לא ניתן לפירוש = בלי תאריך.
  const verStamp = ver && ver.date ? hebrewVersionStamp(ver.date) : '';
  const tooltip = ver && ver.version ? `גירסא ${ver.version}${verStamp ? ` | ${verStamp}` : ''}` : '';

  return {
    version: MENU_TREE_VERSION,
    brand: {
      href: '/',
      // הלוגו מהגדרת BRAND_LOGO דרך /api/logo (כמו BrandLogo.js); 404 = אין לוגו → מציגים את הטקסט.
      logoUrl: '/api/logo',
      hasLogoSetting: typeof settings.BRAND_LOGO === 'string' && settings.BRAND_LOGO.length > 0,
      name: brandName,
      subtitle: brandSubtitle,
      tooltip,
    },
    tabs,
    rail: {
      search: { show: true, recents: true, history: true, barcodeScan: false }, // סריקת ברקוד ברצף: לא בשלב הזה (SPEC סעיף 8 פתוח)
      errorReport: { show: !flags.hideErrorReporting },
      // "האתר הישן" — אייקון זמני (J04/R12). היעד לא הוכרע ע"י הבעלים; ברירת מחדל מוצעת: מעבר לוריאנט legacy.
      oldSite: logged ? { show: true, temporary: true, action: 'switch-to-legacy-shell', label: 'האתר הישן', badge: 'זמני' } : { show: false },
      bell: showBell
        ? {
          show: true,
          unreadCount: typeof status.unreadCount === 'number' ? status.unreadCount : null,
          tools: { markAllRead: true, clearAll: true },
          rows: bellRows,
        }
        : { show: false },
      shiftClock: { show: logged, activeShift: !!status.activeShift },
    },
    user: {
      logged,
      id: logged ? user.id : null,
      name: logged ? userName(user) : 'אורח',
      initials: logged ? userInitials(user) : 'א',
      roleId: logged ? roleId : null,
      roleLabel: logged ? (ROLE_LABELS[roleId] || DEFAULT_ROLE_LABEL) : 'התחברות לא פעילה',
      department: logged && user.department && user.department.name ? String(user.department.name) : '',
      items: userItems,
    },
    meta: {
      logged,
      roleId,
      head,
      prog,
      requireLogin: !!flags.requireLogin,
      hideInternalMessaging: !msgs,
      managementMessages,
      org: c.org && typeof c.org === 'object' && c.org.id !== undefined ? c.org.id : null,
    },
  };
}

// --- עזרים לרכיב הלקוח -------------------------------------------------------------------
/** כל השורות הניתנות ללחיצה בעץ (לשוניות, תתי-פריטים, משתמש, פעמון), שטוח. */
export function flattenMenuTree(tree) {
  const out = [];
  if (!tree) return out;
  for (const tab of tree.tabs || []) {
    if (tab.soon) continue; // "בקרוב": לא יעד ניווט
    out.push({ id: tab.id, kind: 'tab', label: tab.label, icon: tab.icon, href: tab.href, group: '' });
    for (const it of tab.items || []) if (it.kind === 'link' || it.kind === 'action') out.push({ ...it, group: tab.label });
  }
  for (const it of (tree.user && tree.user.items) || []) if (it.kind === 'link' || it.kind === 'action') out.push({ ...it, group: 'משתמש' });
  for (const it of (tree.rail && tree.rail.bell && tree.rail.bell.rows) || []) if (it.kind === 'link' || it.kind === 'action') out.push({ ...it, group: 'התראות' });
  return out;
}

function splitHref(href) {
  const s = String(href || '');
  const i = s.indexOf('#');
  const noHash = i === -1 ? s : s.slice(0, i);
  const q = noHash.indexOf('?');
  return { path: (q === -1 ? noHash : noHash.slice(0, q)) || '/', query: q === -1 ? '' : noHash.slice(q + 1), hash: i === -1 ? '' : s.slice(i) };
}

/**
 * איזו לשונית ואיזה פריט "נוכחיים" לנתיב הנוכחי — אותו כלל כמו isActive ב-AppShell.js
 * ('/' רק בהתאמה מדויקת, אחרת תחילית), עם העדפה להתאמה הארוכה ביותר; פריט עם #hash מתאים רק כשה-hash זהה.
 * פריט עם ?query (פריטי "בית": /?scope=customers, /?adv=1, /?recent=changes) מתאים רק כשכל הפרמטרים שלו מופיעים בכתובת
 * (search = מחרוזת ה-query הנוכחית, עם או בלי '?'), ואז עדיף על פריט בלי query באותו נתיב ("חיפוש כללי").
 * פריט עם `match` (העמוד הישן של הקטגוריה: /orders, /customers, /rentals#rented...) נשאר "נוכח" גם כשהעובדת בעמוד הישן.
 * @returns {{ tabId: string|null, itemId: string|null }}
 */
export function findActive(tree, pathname, hash = '', search = '') {
  const p = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const h = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  const cur = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  let best = { tabId: null, itemId: null, score: -1 };
  const consider = (tabId, itemId, href) => {
    if (!href) return;
    const { path, query, hash: ih } = splitHref(href);
    let score = -1;
    if (path === '/') { if (p === '/') score = 1; } else if (p === path || p.startsWith(`${path}/`)) score = path.length + 1;
    if (score < 0) return;
    // פריט עם #hash (השכרות / החזרות) מתאים רק כשה-hash זהה; פריט בלי hash מתאים גם כשיש hash בכתובת.
    if (ih) { if (h !== ih) return; score += 1000; }
    // פריט עם query מתאים רק כשכל הפרמטרים שלו קיימים בכתובת בדיוק באותו ערך.
    if (query) {
      const want = new URLSearchParams(query);
      for (const [k, v] of want) if (cur.get(k) !== v) return;
      score += 2000;
    }
    // בשוויון (למשל "/" של לשונית בית ושל "חיפוש כללי") עדיף הפריט המדויק על הלשונית.
    if (score > best.score || (score === best.score && best.itemId === null && itemId !== null)) best = { tabId, itemId, score };
  };
  for (const tab of (tree && tree.tabs) || []) {
    consider(tab.id, null, tab.href);
    for (const it of tab.items || []) {
      if (it.kind !== 'link') continue;
      consider(tab.id, it.id, it.href);
      if (it.match) consider(tab.id, it.id, it.match);
    }
  }
  return { tabId: best.tabId, itemId: best.itemId };
}

/** true אם העץ ניתן לסריאליזציה ל-JSON בלי אובדן (בלי פונקציות / undefined בתוך מערכים). */
export function isJsonSafe(tree) {
  try {
    const s = JSON.stringify(tree);
    return typeof s === 'string' && JSON.stringify(JSON.parse(s)) === s;
  } catch (e) {
    return false;
  }
}
