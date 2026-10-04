// lib/uiVariant.js — דגלי הפצה "ישן / A5" לכל מסך (תשתית בלבד, בלי שינוי גלוי).
//
// נכתב כ-ESM טהור בלי imports של Next/prisma (כמו lib/designPrefsSchema.js), כדי שיהיה בטוח
// לשרת ולקליינט ואפשר יהיה לבדוק אותו עם node רגיל (scripts/test_ui_variant.mjs).
//
// מסכים: 'shell' (המעטפת/התפריט), 'home' (דף הבית), 'order_card' (כרטיס הזמנה),
//        'customer_card' (כרטיס לקוח), 'employee_card' (כרטיס עובד - ניהול, /employees/[id]).
// ערכים: 'legacy' | 'a5'.
//
// סדר ההכרעה (החזק קודם):
//   1. עקיפה אישית של העובד — העדפות העיצוב פר-עובד (Employee.themeColor JSON, מפתח `uiVariants`,
//      ר' lib/designPrefsSchema.js). ערך לא תקין = "אין עקיפה" ונופלים לשלב הבא.
//   2. הגדרת הארגון — SystemSetting `ui_variant_<screen>` (הגדרה נפרדת בכל DB, ולכן בכל גמ"ח).
//      ערך לא תקין / ריק / חסר = ברירת המחדל.
//   3. ברירת מחדל: 'legacy'.
// כל דבר לא מוכר (מסך, ערך, סוג) מתנקז ל-'legacy'.
//
// חריג: 'shell' הוא תמיד 'legacy' במסכי קיוסק (/customer-interface), שעון נוכחות
// (/punch-clock) ובכל מסכי ההדפסה — שם אסור שמעטפת חדשה תופיע (ר' isForcedLegacyPath).
//
// הערה לגבי אבטחה: זה דגל תצוגה בלבד. העקיפה האישית מגיעה בשרת מהעוגייה designPrefs_<id>
// (מראה שנכתבת מה-DB ע"י DesignPrefsSync) כדי לא להוסיף שאילתת DB לכל בקשה — העוגייה ניתנת לעריכה
// ע"י המשתמש עצמו, ולכן אסור להשתמש בדגל הזה כגבול הרשאות (ההרשאות נאכפות ב-PageGate / checkAuth).
// במילים פשוטות: "עובד לא יכול להדליק לעצמו A5" נכון רק דרך ה-API (PUT /api/me/design-prefs מוחק
// uiVariants); דרך עריכת העוגייה בדפדפן שלו הוא כן יכול, וה-layout לא מאמת מול ה-DB (במסלול המהיר של
// auth_session אין שאילתת עובד בכלל). נקודה פתוחה לפני הדלקה אמיתית — ר' docs/menu-a5-build-plan.md סעיף 2.

export const UI_SCREENS = ['shell', 'home', 'order_card', 'customer_card', 'employee_card'];
export const UI_VARIANTS = ['legacy', 'a5'];
export const DEFAULT_UI_VARIANT = 'legacy';

// מפתחות SystemSetting לכל מסך (ברירת מחדל כשהשורה חסרה = 'legacy').
export const UI_VARIANT_SETTING_KEYS = {
  shell: 'ui_variant_shell',
  home: 'ui_variant_home',
  order_card: 'ui_variant_order_card',
  customer_card: 'ui_variant_customer_card',
  employee_card: 'ui_variant_employee_card',
};
export const UI_VARIANT_SETTING_KEY_LIST = UI_SCREENS.map((s) => UI_VARIANT_SETTING_KEYS[s]);

export function isUiScreen(screen) {
  return typeof screen === 'string' && UI_SCREENS.includes(screen);
}

// קפדני: בדיוק 'legacy' או 'a5' (בלי רווחים / אותיות גדולות). משמש לאימות ערכים שנכתבים.
export function isValidUiVariant(value) {
  return typeof value === 'string' && UI_VARIANTS.includes(value);
}

// סלחני: מקבל גם רווחים ואותיות גדולות (ערך שהוקלד ידנית בטבלת ההגדרות). כל דבר אחר = 'legacy'.
export function normalizeUiVariant(value) {
  if (typeof value !== 'string') return DEFAULT_UI_VARIANT;
  const v = value.trim().toLowerCase();
  return UI_VARIANTS.includes(v) ? v : DEFAULT_UI_VARIANT;
}

// מנקה אובייקט עקיפות אישיות: רק מסכים מוכרים עם ערכים תקינים. מחזיר undefined כשאין מה לשמור,
// כדי שהעמודה לא תכיל אובייקט ריק. משמש את sanitizeDesignPrefs.
export function sanitizeUiVariants(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const out = {};
  for (const screen of UI_SCREENS) {
    if (isValidUiVariant(input[screen])) out[screen] = input[screen];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// נתיבים שבהם המעטפת החדשה אסורה: קיוסק לקוחות, שעון נוכחות, וכל מסכי ההדפסה
// (/print/* וכן /dashboard/dresses/<id>/print). התאמה לפי גבול מקטע, לא תחילית גולמית.
const FORCED_LEGACY_PREFIXES = ['/customer-interface', '/punch-clock', '/print'];

export function isForcedLegacyPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  const p = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  for (const prefix of FORCED_LEGACY_PREFIXES) {
    if (p === prefix || p.startsWith(prefix + '/')) return true;
  }
  return p.endsWith('/print');
}

// settings יכול להיות מערך שורות { key, value } (כמו getAllCachedSettings) או מפה { key: value }.
function readOrgValue(settings, key) {
  if (!settings) return undefined;
  if (Array.isArray(settings)) {
    const row = settings.find((s) => s && s.key === key);
    return row ? row.value : undefined;
  }
  if (typeof settings === 'object') return settings[key];
  return undefined;
}

/**
 * מכריע את הגרסה של מסך אחד.
 * @param {string} screen  אחד מ-UI_SCREENS (כל דבר אחר → 'legacy')
 * @param {{ userVariants?: object, settings?: Array|object, pathname?: string }} [ctx]
 * @returns {'legacy'|'a5'}
 */
export function resolveUiVariant(screen, ctx = {}) {
  if (!isUiScreen(screen)) return DEFAULT_UI_VARIANT;
  const { userVariants, settings, pathname } = ctx || {};

  if (screen === 'shell' && isForcedLegacyPath(pathname)) return 'legacy';

  if (userVariants && typeof userVariants === 'object' && isValidUiVariant(userVariants[screen])) {
    return userVariants[screen];
  }

  return normalizeUiVariant(readOrgValue(settings, UI_VARIANT_SETTING_KEYS[screen]));
}

/** מכריע את כל המסכים בבת אחת: { shell, home, order_card, customer_card, employee_card }. */
export function resolveUiVariants(ctx = {}) {
  const out = {};
  for (const screen of UI_SCREENS) out[screen] = resolveUiVariant(screen, ctx);
  return out;
}
