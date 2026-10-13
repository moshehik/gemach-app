// lib/gmachContact.js - "כתובת האיסוף" שמוצגת ללקוחות (מייל אישור הזמנה, תזכורות, כרטיס הזמנה, ה-PDF המצורף וההדפסה) - טהור, בלי prisma.
//
// בעיה (דיווח הבעלים, נווה יעקב, 12.10.2026): "כתובת האיסוף" במייל הציגה את הערך של `gmach_address`, ובנווה הוא "צוקרמן 1 נווה יעקב - גבעת שאול 23.
// שימו לב: ..." - כלומר כתובת שנייה והערה, לא "נווה יעקב" בלבד. אין בקוד שום כתובת ברירת מחדל או נפילה לארגון אחר: הערך תמיד מההגדרות של
// ה-DB של הארגון הנוכחי.
// הפתרון: הגדרה ייעודית `gmach_pickup_address` (כתובת האיסוף ללקוחות). כשהיא קיימת ולא ריקה - היא כתובת האיסוף בכל המיילים/המסמכים ללקוחות;
// אחרת (שורה חסרה/ריקה) נשארת ההתנהגות הקודמת: `gmach_address`. אין נפילה לשום ערך אחר.
export const PICKUP_ADDRESS_KEY = 'gmach_pickup_address';

/**
 * @param {(key:string)=>any} get קורא ערך הגדרה לפי מפתח (למשל (k) => settings.find(s => s.key === k)?.value)
 * @returns {string} כתובת האיסוף להצגה ללקוחות ('' כשאין אף אחת)
 */
export function pickupAddressFrom(get) {
  const dedicated = String(get(PICKUP_ADDRESS_KEY) ?? '').trim();
  if (dedicated) return dedicated;
  return String(get('gmach_address') ?? '').trim();
}

/** כמו pickupAddressFrom, ממערך [{key,value}] (getAllCachedSettings / תשובת /api/settings). */
export function pickupAddressFromList(settings) {
  const list = Array.isArray(settings) ? settings : [];
  return pickupAddressFrom((k) => { const s = list.find((x) => x && x.key === k); return s ? s.value : undefined; });
}

// קישור ניווט "פתיחה במפות Google" ליד כתובת האיסוף (מייל אישור, מייל כרטיס הזמנה, PDF מצורף, הדפסה).
// נגזר אוטומטית מ-gmach_pickup_address; `gmach_pickup_maps_url` (אופציונלי, חייב להתחיל ב-http/https) גובר אם הוזן.
// אופט-אין: בלי gmach_pickup_address ובלי gmach_pickup_maps_url אין קישור (הגמ"ח הראשי - ללא שינוי).
export const PICKUP_MAPS_URL_KEY = 'gmach_pickup_maps_url';
export const PICKUP_MAPS_LABEL = 'פתיחה במפות Google';

export function pickupMapsUrlFrom(get) {
  const custom = String(get(PICKUP_MAPS_URL_KEY) ?? '').trim();
  if (/^https?:\/\//i.test(custom)) return custom;
  const dedicated = String(get(PICKUP_ADDRESS_KEY) ?? '').trim();
  if (!dedicated) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dedicated)}`;
}

/** כמו pickupMapsUrlFrom, ממערך [{key,value}]. */
export function pickupMapsUrlFromList(settings) {
  const list = Array.isArray(settings) ? settings : [];
  return pickupMapsUrlFrom((k) => { const x = list.find((y) => y && y.key === k); return x ? x.value : undefined; });
}
