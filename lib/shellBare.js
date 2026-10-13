// lib/shellBare.js - נתיבים שמרונדרים "ללא שלד האתר" (בלי סרגל צד / תפריט עליון / באנרים / ווידג'טים צפים של הצוות).
//
// ESM טהור בלי imports (כמו lib/uiVariant.js): בטוח לשרת (app/layout.js, לפי x-pathname) ולקליינט (usePathname ב-ShellSwitch /
// HideOnKioskBare), ואפשר לבדוק אותו עם node רגיל (scripts/test_kiosk_bare.mjs).
//
// למה גם בקליינט: ה-root layout לא מרונדר מחדש בניווט רך (ר' ההערה על data-ui-* ב-app/layout.js). ניווט רך מדף עם שלד (למשל מהקישור "עמדת לקוח"
// בתפריט) ל-/customer-interface משאיר את השלד מורכב; לכן המעטפת עצמה (ShellSwitch) בודקת את הנתיב הנוכחי באותו רינדור של הניווט - בלי הבהוב.
// ובכיוון ההפוך: עמדה שנטענה בטעינה מלאה (בלי שלד) לא יכולה לנווט רך אל דף עם שלד (ה-layout כבר החליט) - ולכן היציאה ממנה היא ניווט מלא
// (KioskA5 / LegacyKioskPage: window.location.assign('/')).

// עמדת הלקוח של החנות (A5 וגם הישנה - אותו נתיב; הבחירה ביניהן ב-KioskSwitch לפי ui_variant_kiosk, אחרי שהדף כבר נטען).
const KIOSK_BARE_PATH = '/customer-interface';

function cleanPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return '';
  return pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

// התאמה לפי גבול מקטע (לא תחילית גולמית): /customer-interface ותת-נתיביו, לא /customer-interfaces.
export function isKioskBarePath(pathname) {
  const p = cleanPath(pathname);
  return p === KIOSK_BARE_PATH || p.startsWith(`${KIOSK_BARE_PATH}/`);
}
