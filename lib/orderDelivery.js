// lib/orderDelivery.js - הצגת המשלוח במסמכי הזמנה (מייל אישור, PDF מצורף, הדפסה, כרטיס) - טהור, בלי prisma/React/@/.
//
// הנושא (דוחות, 12.10.2026): "במייל הקבלה של ביצוע הזמנה לא מוזכר המשלוח ... וגם בקובץ המודפס. המשלוח יופיע כפריט בשורת
// הפריטים (עם הגדרה מותאמת אישית בניהול)". הקובץ הזה הוא *תצוגה בלבד*: הוא לא מחשב מחיר ולא נוגע בחיוב (חישוב המחיר נשאר
// ב-lib/pricingCalc.js / pricingEngine.js `applyDeliveryCharge`, ושינוי המחיר של "shared-delivery" יושב שם). הסכום הכולל של
// ההזמנה זהה עם ההגדרה ובלעדיה - שורת המשלוח ב"פריטים" היא אותו PaymentObligation שכבר נספר ב"סה"כ לחיוב".
//
// הפונקציה האחת שכל משטח צורך: buildDeliverySection(order, opts) -> null כשאין מה להציג, אחרת אובייקט עם
//   rows        [{key,label,value,ltr?}]  - שורות "כרטיס פרטים" (מייל/הדפסה): סוג, כתובת, מועד הלוך/חזור, עלות
//   itemRow     {label,detail,amount}|null - שורת הפריט (רק כשההגדרה delivery_as_item_row דלוקה)
//   textLines   string[]                   - אותו מידע כשורות טקסט פשוט (גוף text/plain של המייל)
//   title / direction / city / addressLine / out / back / amount / warnings ...
// המטפל הנפרד לעורך התבניות (feature/email-center) יכול לצרוך `rows` ו-`itemRow` כמו שהם.
//
// ברירת מחדל = ההתנהגות הקודמת: בלי ההגדרה delivery_as_item_row אין itemRow; בלי enable_deliveries (הגמ"ח הראשי) -> null תמיד.
import { addBusinessDays, rollForwardToWorkingDay, localDateFromKey, parseNonWorkingDaysSetting, NON_WORKING_DAYS_SETTING_KEY } from './businessDays';
import { getHebrewDateString, getHebrewWeekdayLabel, getIsraelDateKey } from './hebrewDate';

export const DELIVERY_AS_ITEM_ROW_KEY = 'delivery_as_item_row';

/** חיוב משלוח = PaymentObligation פעיל, לא זיכוי, לא מקושר לפריט, שהתיאור שלו מכיל "משלוח" (אותו כלל כמו applyDeliveryCharge). */
export function isDeliveryObligation(o) {
  return !!o && !o.isDeleted && !o.isRefund && !o.orderItemId && String(o.description || '').includes('משלוח');
}

/** סכום חיובי המשלוח של ההזמנה, או null כשאין חיוב משלוח (עיר ללא מחיר / עדיין לא חושב). */
export function deliveryChargeOf(obligations) {
  const list = (obligations || []).filter(isDeliveryObligation);
  if (!list.length) return null;
  return list.reduce((s, o) => s + (Number(o.amount) || 0), 0);
}

const bool = (v) => v === true || v === 'true';

/** מחלץ את ההגדרות הרלוונטיות ממערך [{key,value}] (getAllCachedSettings / תשובת /api/settings) או ממפה {key:value}. */
export function deliverySettingsFrom(settings) {
  const map = {};
  if (Array.isArray(settings)) for (const s of settings) { if (s && s.key) map[s.key] = s.value; }
  else if (settings && typeof settings === 'object') Object.assign(map, settings);
  const n = (v, d) => { const x = parseInt(v, 10); return Number.isNaN(x) ? d : x; };
  return {
    enabled: bool(map.enable_deliveries),
    asItemRow: bool(map[DELIVERY_AS_ITEM_ROW_KEY]),
    daysBefore: n(map.delivery_days_before, 1),
    daysAfter: n(map.delivery_days_after, 1),
    skipWeekend: bool(map.delivery_skip_weekends),
    nonWorking: parseNonWorkingDaysSetting(map[NON_WORKING_DAYS_SETTING_KEY] ?? null),
  };
}

const money = (n) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

function dateText(key) {
  const d = key ? localDateFromKey(key) : null;
  if (!d) return '';
  return `${getHebrewWeekdayLabel(d)} ${getHebrewDateString(d)}`.trim();
}

/**
 * ימי היציאה (הלוך) והאיסוף (חזור) - אותה נוסחה בדיוק כמו getDeliveriesForDate (lib/deliveries.js): הלוך = N ימי עסקים לפני האירוע
 * (1 ב"משלוח יום לפני"), חזור = N ימי עסקים אחרי (0 = אותו יום, מתגלגל ליום עבודה). מחזיר מפתחות 'YYYY-MM-DD' או null.
 */
export function deliveryDispatchKeys({ eventDate, direction, oneDayBefore, daysBefore, daysAfter, nonWorking, skipWeekend }) {
  const eventKey = eventDate ? getIsraelDateKey(eventDate) : null;
  if (!eventKey) return { out: null, back: null };
  const opts = { skipWeekend: !!skipWeekend };
  const dir = direction || 'הלוך-חזור';
  const out = dir !== 'חזור' ? addBusinessDays(eventKey, -(oneDayBefore ? 1 : daysBefore), nonWorking, opts) : null;
  const back = dir !== 'הלוך'
    ? (daysAfter === 0 ? rollForwardToWorkingDay(eventKey, nonWorking) : addBusinessDays(eventKey, daysAfter, nonWorking, opts))
    : null;
  return { out, back };
}

/**
 * @param {object} order  { isDelivery, deliveryDirection, deliveryAddress, deliveryCity, deliveryOneDayBefore, eventDate, isAbroad,
 *                          customer?:{city,street,houseNum}, obligations?:[{amount,description,isDeleted,isRefund,orderItemId}] }
 * @param {object} [opts] { settings: מערך/מפה של הגדרות (או התוצאה של deliverySettingsFrom), obligations: אם ההזמנה לא נושאת אותם }
 * @returns {null|object}
 */
export function buildDeliverySection(order, opts = {}) {
  if (!order || !order.isDelivery) return null;
  const st = opts.settings && 'asItemRow' in opts.settings && 'nonWorking' in opts.settings ? opts.settings : deliverySettingsFrom(opts.settings);
  if (!st.enabled) return null; // הגמ"ח הראשי: אין משלוחים - שום משטח לא משתנה

  const direction = order.deliveryDirection || 'הלוך-חזור';
  const cust = order.customer || {};
  const orderStreet = String(order.deliveryAddress || '').trim();
  const orderCity = String(order.deliveryCity || '').trim();
  // אותו fallback כמו רשימת המשלוחים (lib/deliveries.js): בלי כתובת/עיר במשלוח - כתובת הלקוחה
  const custStreet = [cust.street, cust.houseNum].filter(Boolean).join(' ').trim();
  const street = orderStreet || custStreet;
  const city = orderCity || String(cust.city || '').trim();
  const addressLine = street && city ? `${street}, ${city}` : (street || city || '');

  const keys = deliveryDispatchKeys({
    eventDate: order.isAbroad ? null : order.eventDate, direction, oneDayBefore: !!order.deliveryOneDayBefore,
    daysBefore: st.daysBefore, daysAfter: st.daysAfter, nonWorking: st.nonWorking, skipWeekend: st.skipWeekend,
  });
  const out = keys.out ? { key: keys.out, text: dateText(keys.out) } : null;
  const back = keys.back ? { key: keys.back, text: dateText(keys.back) } : null;

  const amount = deliveryChargeOf(opts.obligations || order.obligations);
  const warnings = [];
  if (!addressLine) warnings.push('no-address');
  if (amount === null) warnings.push('no-charge');

  const title = `משלוח ${direction}`;
  const rows = [{ key: 'type', label: 'משלוח', value: direction }];
  if (addressLine) rows.push({ key: 'address', label: 'כתובת המשלוח', value: addressLine });
  if (out) rows.push({ key: 'out', label: 'מועד המשלוח (הלוך)', value: out.text });
  if (back) rows.push({ key: 'back', label: 'מועד האיסוף (חזור)', value: back.text });
  // כשהמשלוח מוצג כשורת פריט המחיר מופיע שם, ולא פעמיים
  if (amount !== null && !st.asItemRow) rows.push({ key: 'cost', label: 'עלות משלוח', value: money(amount) });

  const detailParts = [addressLine, out ? `הלוך: ${out.text}` : '', back ? `חזור: ${back.text}` : ''].filter(Boolean);
  const itemRow = st.asItemRow ? { label: title, detail: detailParts.join(' · '), amount } : null;

  const textLines = [`${title}${addressLine ? `: ${addressLine}` : ''}`];
  if (out) textLines.push(`מועד המשלוח (הלוך): ${out.text}`);
  if (back) textLines.push(`מועד האיסוף (חזור): ${back.text}`);
  if (amount !== null && !st.asItemRow) textLines.push(`עלות משלוח: ${money(amount)}`);

  return { show: true, direction, title, city, street, addressLine, out, back, amount, asItemRow: st.asItemRow, rows, itemRow, textLines, warnings };
}

/** שורת הפריט כטקסט פשוט ("משלוח הלוך-חזור - כתובת - ₪120") לגוף text/plain וליומן. */
export function deliveryItemRowText(section) {
  const r = section && section.itemRow;
  if (!r) return '';
  return `${r.label}${r.detail ? ` (${r.detail})` : ''}${r.amount !== null && r.amount !== undefined ? ` - ${money(r.amount)}` : ''}`;
}
