// lib/adminHubCatalog.js — קטלוג "מסך ניהול ראשי" (/admin) בעיצוב המאושר (תצוגות-עיצוב/ניהול-ראשי-כרטיסים.html, 4.10.2026).
//
// צד שרת בלבד: רק app/admin/page.js ו-app/layout.js (מאגר פאנל "ניהול" המקוצר, רק הכלים המותרים) מייבאים אותו. אסור לייבא מכאן בשום רכיב 'use client' — אחרת כל הקטלוג (כולל כלי המתכנת
// והשערים) נשלח לדפדפן של כל משתמש. נבדק סטטית ב-scripts/test_admin_hub.mjs (גרף הייבוא של הרכיבים בצד הלקוח).
// מודול טהור (בלי React/Next/prisma/`@/`) כדי שייטען גם ב-node רגיל לבדיקות.
// app/admin/page.js מחשב את השערים עם checkPageAccess, מסנן כאן (selectHub) ומעביר לרכיב רק את אובייקטי הכלים המותרים
// והקטגוריות שלהם; הרכיב (app/components/admin-hub/AdminHubPage.js) משתמש רק בעזרים הטהורים של lib/adminHubView.js.
//
// החלטות הבעלים (scratch/admin-hub-build/answers-admin-cards.json, 4.10.2026) שמיושמות כאן:
// - מסך אחד ב-/admin במקום שני מסכים (/admin + /admin/site). /admin/site נשאר כדף נפרד "ניהול אתר" למתכנת בלבד
//   (cov:/admin/site "רק מתכנת"); כל אחד אחר שמגיע אליו מועבר ל-/admin (app/admin/site/layout.js).
// - נדרים פלוס: הקטגוריה מוסתרת כשההגדרה nedarim_plus_enabled של הגמ"ח היא בדיוק 'false' (כמו app/orders/new/page.js: !== 'false' = פעיל).
// - 9 קטגוריות בשמות של העיצוב. "שלב את טאב זיכויים באותו טאב" (על אריח המחירון): קטגוריית "זיכויים" של העיצוב מוזגה
//   לקטגוריה של המחירון ("תמחור וחישובים"), והמקום שהתפנה הוא של "נדרים פלוס - הוראות קבע" (ההצעה בעיצוב: אחרי "זיכויים").
// - "הרשאות": "ההגדרות, טאב ראשון" = ראשון בקטגוריית "הגדרות ומיתוג".
// - אריח מחירון אחד (שני האריחים הובילו לאותו דף); התיאור מאחד את שני הכיתובים הקיימים.
// - בלי: רשימת מיילים מלאה (חלון), מתכנן זיכויים ("שמור אבל בלי גישה"), סימולטור זיכויים, מערכת ביקורת, איפוס נתונים,
//   מפת הגדרות - מדריך, מערכת העיצוב (cov "לא" — התשובה המאוחרת מבין שתיים סותרות). הדפים עצמם לא נמחקו.
//
// שערים (gate) — אותם מערכי תפקיד שהדפים עצמם בודקים עם checkPageAccess (lib/auth.js):
//   'head'     = HEAD_MANAGEMENT_ROLES [0,2] — השער של app/admin/layout.js (וגם /management, /dashboard/pricelist, /dashboard)
//   'dev'      = DEVELOPER_ONLY_ROLES [2]   — מתכנת בלבד (הערת הבעלים "רק מתכנת"; הדפים מקבלים layout עם אותו שער)
//   'headOnly' = [0]                         — "רק מנהל ראשי" (רשימת הו״ק). הדף עצמו נשאר בשער [0,2] — ר' HEAD_ONLY_NOTE.
// ההסתרה כאן היא רק נוחות: כל דף שומר על השער שלו בצד השרת, וה-API שמאחוריו על checkAuth משלו.

export const ADMIN_HUB_VERSION = 1;

/** מערכי התפקיד לכל שער. head/dev זהים ל-HEAD_MANAGEMENT_ROLES / DEVELOPER_ONLY_ROLES ב-lib/auth.js (נבדק ב-test_admin_hub). */
export const GATE_ROLES = Object.freeze({ head: Object.freeze([0, 2]), dev: Object.freeze([2]), headOnly: Object.freeze([0]) });
export const GATES = Object.freeze(Object.keys(GATE_ROLES));
export const HEAD_ONLY_NOTE = 'רשימת הו״ק מוסתרת מהמתכנת במסך הניהול בלבד; הדף /admin/nedarim-hok-list וה-API שלו (checkAuth("הנהלה ראשית")) עדיין פתוחים גם למתכנת.';

// הקטגוריות לפי הסדר. tag = התגית שמופיעה בכל שורה (rlbl), icon = מזהה ב-sprite של הפלטה (בלי הקידומת).
export const CATEGORIES = Object.freeze([
  { id: 'settings', title: 'הגדרות ומיתוג', tag: 'הגדרות', icon: 'gear' },
  { id: 'pricing', title: 'תמחור וחישובים', tag: 'תמחור', icon: 'tag' },
  { id: 'nedarim', title: 'נדרים פלוס - הוראות קבע', tag: 'נדרים', icon: 'card' },
  { id: 'insights', title: 'תובנות ודוחות', tag: 'דוחות', icon: 'sig' },
  { id: 'control', title: 'בקרה ואבטחה', tag: 'בקרה', icon: 'shield' },
  { id: 'data', title: 'נתונים והיסטוריה', tag: 'נתונים', icon: 'table' },
  { id: 'backup', title: 'גיבוי ושחזור', tag: 'גיבוי', icon: 'clock' },
  { id: 'mail', title: 'מיילים', tag: 'מייל', icon: 'mail' },
  { id: 'setup', title: 'ייבוא והתקנה', tag: 'ייבוא', icon: 'ext' },
  // 4.10.2026 (תפריט "ניהול" מקוצר, docs/admin-menu-short-2026-10-04.md): הדפים שהיו שורות קבועות בתפריט ואין להם מקום אחר
  // במסך — כדי ש"כל השאר בתוך דף הניהול" יהיה נכון. בסוף הרשימה, כדי לא להזיז את הקטגוריות שאושרו בעיצוב.
  { id: 'daily', title: 'עבודה שוטפת', tag: 'שוטף', icon: 'box' },
].map(Object.freeze));

// כל הכלים. הכותרות, התיאורים והאייקונים — מהעיצוב המאושר (או, לכלי שלא היה בו, מהצעת הסקירה שאושרה / מהכרטיס הקיים).
export const TOOLS = Object.freeze([
  // הגדרות ומיתוג
  { id: 'permissions', cat: 'settings', href: '/admin/permissions', icon: 'lock', gate: 'head', title: 'הרשאות', desc: 'מי נכנס לאיזה עמוד ומי רשאי לאשר פעולות, לפי מחלקה ולפי עובד' },
  { id: 'settings', cat: 'settings', href: '/admin/settings', icon: 'gear', gate: 'head', title: 'הגדרות מערכת', desc: 'תצורה, מיתוג, מדיניות תשלומים, ברקודים, הודעות, אוטומציה וסנכרון' },
  { id: 'site', cat: 'settings', href: '/admin/site', icon: 'sliders', gate: 'dev', title: 'ניהול אתר', desc: 'דוחות ותובנות, בקרה והתראות, נתונים ומערכת' },
  { id: 'site-settings', cat: 'settings', href: '/admin/site-settings', icon: 'gear', gate: 'dev', title: 'הגדרות אתר', desc: 'מסד נתונים, מערכת ומיילים (מתכנת בלבד)' },
  { id: 'api-keys', cat: 'settings', href: '/admin/site-settings/api-keys', icon: 'shield', gate: 'dev', title: 'מפתחות API', desc: 'כניסה בלי סיסמה לסוכנים וסקריפטים (מתכנת בלבד)' },
  { id: 'labels', cat: 'settings', href: '/admin/labels', icon: 'tag', gate: 'dev', title: 'שינוי שמות', desc: 'כיתובים וטקסטים' },
  // תמחור וחישובים (כולל "זיכויים" שמוזגה לכאן)
  { id: 'pricelist', cat: 'pricing', href: '/dashboard/pricelist', icon: 'tag', gate: 'head', title: 'ניהול מחירון', desc: 'הגדרת מחירי השכרה לפי קטגוריה ומידה, צפייה והדפסה' },
  { id: 'recalculations', cat: 'pricing', href: '/admin/recalculations', icon: 'cash', gate: 'head', title: 'חישובים', desc: 'פערי תשלומים' },
  { id: 'refund-policy', cat: 'pricing', href: '/admin/refund-policy', icon: 'note', gate: 'head', title: 'מדיניות זיכויים', desc: 'תיעוד חוקי ביטול' },
  // 4.10.2026: יצא מהשורות הקבועות של תפריט "ניהול". כאן ולא ב"עבודה שוטפת" — הבעלים מיזג את "זיכויים" לקטגוריה הזו.
  // הדף עצמו: PageGate page:refunds; הנהלה ראשית / מתכנת תמיד עוברים (ALWAYS_ALLOWED_ROLE_IDS) — ולכן שער head מדויק.
  { id: 'refunds', cat: 'pricing', href: '/refunds', icon: 'wallet', gate: 'head', pageKey: 'page:refunds', title: 'זיכויים וחובות', desc: 'יתרות זכות וחובות של לקוחות' },
  // נדרים פלוס - הוראות קבע
  { id: 'nedarim-hok-list', cat: 'nedarim', href: '/admin/nedarim-hok-list', icon: 'list', gate: 'headOnly', title: 'רשימת הוראות קבע (הו״ק)', desc: 'ההוראות הפעילות בנדרים פלוס, כפי שהן בממשק שלהם' },
  { id: 'nedarim-hok-search', cat: 'nedarim', href: '/admin/nedarim-hok-search', icon: 'search', gate: 'head', title: 'חיפוש בהוראות קבע', desc: 'חיפוש לפי מספר הו״ק, שם, טלפון או ת.ז' },
  { id: 'nedarim-hok-edit', cat: 'nedarim', href: '/admin/nedarim-hok-edit', icon: 'pencil', gate: 'head', title: 'שינוי הו״ק וגביית תשלום בודד', desc: 'עריכת הוראת קבע קיימת וגביית תשלום בודד מהכרטיס השמור' },
  { id: 'nedarim-payments-recent', cat: 'nedarim', href: '/admin/nedarim-payments-recent', icon: 'cash', gate: 'head', title: 'תשלומים אחרונים בנדרים פלוס', desc: 'היסטוריית עסקאות האשראי הכללית של המוסד' },
  { id: 'nedarim-hok-test', cat: 'nedarim', href: '/admin/nedarim-hok-test', icon: 'plus', gate: 'head', title: 'יצירת הוק (ניסוי)', desc: 'דף ניסוי: יוצר הוראת קבע אמיתית בנדרים פלוס' },
  // תובנות ודוחות
  { id: 'ai', cat: 'insights', href: '/admin/ai', icon: 'msg', gate: 'head', title: 'מערכת AI', desc: 'תובנות ודוחות מלל' },
  { id: 'ai-history', cat: 'insights', href: '/admin/ai-history', icon: 'clock', gate: 'head', title: 'היסטוריית AI', desc: 'כלל שיחות העוזר' },
  { id: 'statistics', cat: 'insights', href: '/admin/statistics', icon: 'sig', gate: 'head', title: 'סטטיסטיקה', desc: 'דוחות שאילתות' },
  { id: 'dashboard', cat: 'insights', href: '/dashboard', icon: 'rows', gate: 'head', title: 'דשבורד', desc: 'גרפים ומגמות' },
  { id: 'ai-restrictions', cat: 'insights', href: '/admin/ai-restrictions', icon: 'sliders', gate: 'dev', title: 'מגבלות AI', desc: 'הפעלה, כיבוי והחלפת מגבלות לכל יכולת AI' },
  // בקרה ואבטחה
  { id: 'inventory-alerts', cat: 'control', href: '/admin/inventory-alerts', icon: 'alert', gate: 'head', title: 'התראות מלאי', desc: 'בדיקת Overbooking' },
  { id: 'trusted-devices', cat: 'control', href: '/admin/trusted-devices', icon: 'shield', gate: 'head', title: 'מחשבי מערכת מהימנים', desc: 'כניסה מהירה ב-4 ספרות' },
  { id: 'departments', cat: 'control', href: '/admin/departments', icon: 'users', gate: 'head', title: 'ניהול מחלקות', desc: 'תפקידי עובדים ומספרי מחלקה' },
  { id: 'barcode-invalid', cat: 'control', href: '/admin/barcode-invalid', icon: 'scan', gate: 'head', title: 'ברקודים לא תקינים', desc: 'ברקודים שחזרו לא תקינים - נשארים ברשימה עד סימון טופל' },
  // נתונים והיסטוריה
  { id: 'data-explorer', cat: 'data', href: '/admin/data-explorer', icon: 'search', gate: 'dev', title: 'סייר נתונים', desc: 'שאילתות SQL' },
  { id: 'data-explorer-full', cat: 'data', href: '/admin/data-explorer/full-view', icon: 'table', gate: 'dev', title: 'תצוגה מלאה', desc: 'כל הטבלאות במסך אחד' },
  { id: 'data-history', cat: 'data', href: '/admin/data-history', icon: 'clock', gate: 'head', title: 'היסטוריית נתונים', desc: 'תיעוד שינויים' },
  { id: 'browse-history', cat: 'data', href: '/management/history', icon: 'sig', gate: 'head', title: 'היסטוריית גלישה', desc: 'דפים ושגיאות' },
  // גיבוי ושחזור
  { id: 'database', cat: 'backup', href: '/admin/database', icon: 'table', gate: 'dev', title: 'גיבוי בסיס נתונים', desc: 'גיבוי ושחזור' },
  { id: 'backups', cat: 'backup', href: '/admin/backups', icon: 'table', gate: 'head', title: 'גיבוי לדרייב', desc: 'גיבוי אוטומטי, לחצן מיידי ולוג' },
  // מיילים
  { id: 'email-logs', cat: 'mail', href: '/admin/site-settings/email-logs', icon: 'mail', gate: 'dev', title: 'יומן מיילים', desc: 'כל המיילים שנשלחו' },
  { id: 'email-test', cat: 'mail', href: '/admin/email-test', icon: 'mail', gate: 'head', title: 'בדיקת מיילים', desc: 'שליחת דוגמה מכל סוגי המיילים' },
  { id: 'bulk-email', cat: 'mail', href: '/admin/bulk-email', icon: 'send', gate: 'head', title: 'שליחת מייל לפי תאריך אירוע', desc: 'מייל לכל לקוח עם אירוע בתאריך או בטווח, עם מעקב שליחה' },
  // ייבוא והתקנה
  { id: 'access-import', cat: 'setup', href: '/admin/access-import', icon: 'table', gate: 'dev', title: 'ייבוא מאקסס', desc: 'תיעוד תהליך הייבוא' },
  { id: 'setup-new-machine', cat: 'setup', href: '/admin/setup-new-machine', icon: 'ext', gate: 'head', title: 'התקנה על מחשב חדש', desc: 'סקריפט התקנה + תיעוד' },
  // עבודה שוטפת (4.10.2026): יצאו מהשורות הקבועות של תפריט "ניהול". pageKey = ה-PageGate של הדף (הנהלה תמיד עוברת);
  // עובדים: הדף בשער HEAD_MANAGEMENT_ROLES. משלוחים: needs 'deliveries' = רק כש-enable_deliveries === 'true' (כמו התפריט).
  { id: 'dresses', cat: 'daily', href: '/dashboard/dresses', icon: 'dress', gate: 'head', pageKey: 'page:dresses_catalog', title: 'דגמים', desc: 'קטלוג הדגמים, מידות ומלאי' },
  { id: 'employees', cat: 'daily', href: '/employees', icon: 'users', gate: 'head', title: 'עובדים', desc: 'עובדים ונוכחות' },
  { id: 'deliveries', cat: 'daily', href: '/deliveries', icon: 'truck', gate: 'head', pageKey: 'page:deliveries', needs: 'deliveries', title: 'משלוחים', desc: 'משלוחי שמלות ללקוחות' },
].map(Object.freeze));

// נתיבים שהבעלים החליט שלא יהיו במסך (הדפים נשארים קיימים). לבדיקות ולתיעוד.
export const EXCLUDED_ROUTES = Object.freeze({
  '/api/customers/emails': 'רשימת מיילים מלאה (חלון) — cov "לא"',
  '/admin/refund-planner': 'מתכנן זיכויים — "שמור אבל בלי גישה"',
  '/admin/refund-simulator': 'סימולטור זיכויים אמיתי — "שמור אבל בלי גישה, הוא לא בנוי"',
  '/admin/audit-system': 'מערכת ביקורת (11 סוכנים) — cov "לא"',
  '/management/database': 'איפוס נתונים — cov "לא"',
  '/admin/settings/help': 'מפת הגדרות - מדריך ניהול — "להסיר"',
  '/design-system/': 'מערכת העיצוב — cov "לא" (08:05) גובר על "אשר מיקום, רק מתכנת" (07:58)',
});

/**
 * אילו כלים מוצגים, לפי תוצאות השערים שחושבו בשרת עם checkPageAccess.
 * @param {{head?: boolean, dev?: boolean, headOnly?: boolean}} access
 * @param {{nedarimEnabled?: boolean, deliveriesEnabled?: boolean}} [org] nedarimEnabled=false (ההגדרה nedarim_plus_enabled === 'false')
 *   מסתיר את קטגוריית נדרים פלוס; deliveriesEnabled=true (enable_deliveries === 'true') נדרש לאריח משלוחים (כשל-סגור, כמו התפריט)
 * @returns {string[]} מזהי הכלים, לפי סדר הקטלוג
 */
export function visibleToolIds(access, org = {}) {
  const a = access && typeof access === 'object' ? access : {};
  const o = org && typeof org === 'object' ? org : {};
  const nedarimOff = o.nedarimEnabled === false;
  const deliveriesOn = o.deliveriesEnabled === true;
  return TOOLS.filter((t) => a[t.gate] === true && !(nedarimOff && t.cat === 'nedarim') && !(t.needs === 'deliveries' && !deliveriesOn)).map((t) => t.id);
}

/**
 * checkPageAccess לפי תפקיד, בלי קריאת עוגיות / DB (אותם כללים כמו checkPageAccessCore ב-lib/authTokens.js): מחובר = לפי roleId;
 * אורח = רק כשההתחברות לא חובה. בבדיקות, וב-app/layout.js לפאנל "ניהול" המקוצר (שם roleId ו-require_login כבר נטענו).
 */
export function accessForRole(roleId, { logged = true, requireLogin = true } = {}) {
  const out = {};
  for (const g of GATES) out[g] = logged ? GATE_ROLES[g].includes(roleId) : !requireLogin;
  return out;
}

/**
 * מה נשלח לדפדפן: רק הכלים המותרים (בלי שדה השער) ורק הקטגוריות שיש בהן כלי מותר.
 * @returns {{ tools: Array<{id,cat,href,icon,title,desc}>, categories: Array<{id,title,tag,icon}> }}
 */
export function selectHub(access, org = {}) {
  const ids = new Set(visibleToolIds(access, org));
  const tools = TOOLS.filter((t) => ids.has(t.id)).map(({ id, cat, href, icon, title, desc }) => ({ id, cat, href, icon, title, desc }));
  const cats = new Set(tools.map((t) => t.cat));
  const categories = CATEGORIES.filter((c) => cats.has(c.id)).map(({ id, title, tag, icon }) => ({ id, title, tag, icon }));
  return { tools, categories };
}
