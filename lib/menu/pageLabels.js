// lib/menu/pageLabels.js - תוויות עבריות לכל עמוד באתר (ל"נצפו לאחרונה" / מחסנית הניווט / הפאנל של איקון החיפוש).
// מודול טהור (בלי DOM / DB / Next), נבדק ב-scripts/test_menu_logic.mjs: הבדיקה סורקת את כל app/**/page.js
// ונכשלת כשנוסף עמוד בלי תווית - כדי שבשום מקום לא יוצג נתיב גולמי באנגלית (/stock-check, /my-hours ...).
//
// כלל: עמוד שיש לו פריט בעץ התפריט מקבל את התווית משם (useNavHistory); כאן התווית לכל השאר, וגם הגנה אחרונה:
// תווית שאין בה אות עברית (נתיב / אנגלית, כולל רשומות ישנות שכבר נשמרו ב-sessionStorage) מוחלפת בתווית עברית.

export const FALLBACK_PAGE_LABEL = 'עמוד במערכת';

export const ROUTE_LABELS = Object.freeze({
  '/': 'בית',
  '/admin': 'לוח ניהול',
  '/admin/access-import': 'ייבוא מאקסס',
  '/admin/ai': 'בינה מלאכותית',
  '/admin/ai-history': 'היסטוריית שיחות AI',
  '/admin/ai-restrictions': 'הגבלות AI',
  '/admin/audit-system': 'ביקורת מערכת',
  '/admin/backups': 'גיבויים',
  '/admin/barcode-invalid': 'ברקודים לא תקינים',
  '/admin/bulk-email': 'דיוור המוני',
  '/admin/data-explorer': 'סייר נתונים',
  '/admin/data-explorer/full-view': 'סייר נתונים - תצוגה מלאה',
  '/admin/data-history': 'היסטוריית נתונים',
  '/admin/database': 'מסד נתונים',
  '/admin/departments': 'מחלקות',
  '/admin/email-test': 'בדיקת מייל',
  '/admin/inventory-alerts': 'התראות מלאי',
  '/admin/labels': 'מדבקות',
  '/admin/nedarim-hok-edit': 'עריכת הוראת קבע',
  '/admin/nedarim-hok-list': 'רשימת הוראות קבע',
  '/admin/nedarim-hok-search': 'חיפוש הוראת קבע',
  '/admin/nedarim-hok-test': 'בדיקת הוראות קבע',
  '/admin/nedarim-payments-recent': 'תשלומי נדרים אחרונים',
  '/admin/permissions': 'הרשאות',
  '/admin/recalculations': 'חישובים מחדש',
  '/admin/refund-planner': 'מתכנן זיכויים',
  '/admin/refund-policy': 'מדיניות זיכויים',
  '/admin/refund-simulator': 'סימולטור זיכויים',
  '/admin/settings': 'הגדרות',
  '/admin/settings/help': 'עזרה בהגדרות',
  '/admin/setup-new-machine': 'הגדרת מחשב חדש',
  '/admin/site': 'ניהול אתר',
  '/admin/site-settings': 'הגדרות אתר',
  '/admin/site-settings/api-keys': 'מפתחות API',
  '/admin/site-settings/email-logs': 'יומן מיילים',
  '/admin/statistics': 'סטטיסטיקות',
  '/admin/trusted-devices': 'מכשירים מהימנים',
  '/alterations': 'תיקונים',
  '/board': 'לוח',
  '/customer-interface': 'עמדת לקוח',
  '/customers': 'לקוחות',
  '/dashboard': 'לוח בקרה',
  '/dashboard/dresses': 'שמלות',
  '/dashboard/pricelist': 'מחירון',
  '/deliveries': 'משלוחים',
  '/display-settings': 'עיצוב ותצוגה',
  '/attendance/print': 'הדפסת נוכחות',
  '/employees': 'עובדים',
  '/employees/attendance': 'סיכום נוכחות',
  '/employees/report': 'דוח נוכחות',
  '/management/database': 'ניהול מסד נתונים',
  '/management/history': 'היסטוריית ניהול',
  '/messages': 'הודעות',
  '/my-hours': 'השעות שלי',
  '/non-working-days': 'ימי אי-פעילות',
  '/orders': 'הזמנות',
  '/orders/new': 'הזמנה חדשה',
  '/print/alterations': 'הדפסת תיקונים',
  '/print/delivery-bag': 'הדפסת שקית משלוח',
  '/print/delivery-courier': 'הדפסת דף שליח',
  '/print/order': 'הדפסת הזמנה',
  '/print/customer': 'הדפסת כרטיס לקוח',
  '/profile': 'הפרופיל שלי',
  '/punch-clock': 'שעון נוכחות',
  '/refunds': 'זיכויים וחובות',
  '/rentals': 'השכרות',
  '/schedule': 'לוז',
  '/stock-check': 'בדיקת מלאי',
});

// עמודים דינמיים ([id] / [page]) - לפי תבנית נתיב
const DYNAMIC_LABELS = [
  [/^\/customers\/[^/]+$/, 'לקוח'],
  [/^\/orders\/[^/]+$/, 'הזמנה'],
  [/^\/employees\/[^/]+\/attendance$/, 'נוכחות עובד'],
  [/^\/employees\/[^/]+$/, 'כרטיס עובד'],
  [/^\/dashboard\/dresses\/[^/]+\/print$/, 'הדפסת דגם'],
  [/^\/dashboard\/dresses\/[^/]+$/, 'דגם'],
  [/^\/schedule\/print\/[^/]+$/, 'הדפסת לוז'],
];

const HEBREW_LETTER = /[א-ת]/;

function barePath(input) {
  let p = typeof input === 'string' ? input.trim() : '';
  p = p.split(/[?#]/)[0];
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+$/, '') || '/';
}

/** תווית עברית לנתיב עמוד (תמיד מחזירה טקסט עברי; לנתיב לא מוכר - התווית של האב הקרוב, ואחרת "עמוד במערכת"). */
export function pageLabel(input) {
  const p = barePath(input);
  if (ROUTE_LABELS[p]) return ROUTE_LABELS[p];
  for (const [re, label] of DYNAMIC_LABELS) if (re.test(p)) return label;
  const parts = p.split('/').filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const parent = '/' + parts.join('/');
    if (ROUTE_LABELS[parent]) return ROUTE_LABELS[parent];
  }
  return FALLBACK_PAGE_LABEL;
}

/** האם יש לנתיב תווית מפורשת (מדויקת או דינמית) - לבדיקה שכל עמוד חדש קיבל תווית, בלי נפילה לאב/ברירת מחדל. */
export function hasPageLabel(input) {
  const p = barePath(input);
  return !!ROUTE_LABELS[p] || DYNAMIC_LABELS.some(([re]) => re.test(p));
}

/** מגן אחרון: תווית עם אות עברית נשארת; אחרת (ריק / נתיב / אנגלית) - התווית העברית של הנתיב. */
export function hebrewLabelOr(label, path) {
  const s = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : '';
  if (s && HEBREW_LETTER.test(s)) return s;
  // עמוד ישות (הזמנה / לקוח / דגם) שהדף העשיר בשם: נשמר כמות שהוא (למשל "52103"), לא מוחלף בתווית כללית
  if (s && /^\/(orders|customers|dashboard\/dresses)\/[^/?#]+/.test(typeof path === 'string' ? path : '')) return s;
  return pageLabel(path);
}
