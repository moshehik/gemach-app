// lib/orderDelivery.js - הצגת המשלוח במסמכי הזמנה (מייל אישור, PDF מצורף, הדפסה, כרטיס) - טהור, בלי prisma/React/@/.
//
// הנושא (דוחות, 12.10.2026): "במייל הקבלה של ביצוע הזמנה לא מוזכר המשלוח ... וגם בקובץ המודפס. המשלוח יופיע כפריט בשורת
// הפריטים (עם הגדרה מותאמת אישית בניהול)" + תוספת הבעלים: שורה לכל כיוון (משלוח הלוך / משלוח חזור) וכיתוב "שימו לב" עם שעות
// הכיוונים. הקובץ הזה הוא *תצוגה בלבד*: הוא לא מחשב מחיר ולא נוגע בחיוב (חישוב המחיר נשאר ב-lib/pricingCalc.js / pricingEngine.js
// `applyDeliveryCharge`, ושינוי המחיר של "shared-delivery" יושב שם). הסכום הכולל של ההזמנה זהה עם ההגדרה ובלעדיה - שורות המשלוח ב"פריטים"
// הן פיצול תצוגה של אותו PaymentObligation שכבר נספר ב"סה"כ לחיוב" (סכום השורות = חיוב המשלוח).
//
// הפונקציה האחת שכל משטח צורך: buildDeliverySection(order, opts) -> null כשאין מה להציג, אחרת אובייקט עם
//   rows        [{key,label,value}]            - שורות "כרטיס פרטים" (מייל/הדפסה): סוג, כתובת, מועד הלוך/חזור, עלות
//   itemRows    [{key:'out'|'back',label,detail,amount}] - שורות הפריטים, שורה לכל כיוון (רק כשההגדרה delivery_as_item_row דלוקה, אחרת [])
//   summaryRows [{key,label,amount}]           - פירוט המשלוח (הלוך/חזור) לסיכום התשלום - תמיד כשיש חיוב; כבר כלול בסה"כ לחיוב
//   notice      {text, lines:[{key,label,hours,text}], plain:[...]}|null - כיתוב "שימו לב" (טקסט + שעות לכל כיוון רלוונטי בלבד)
//   textLines   string[]                       - אותו מידע כשורות טקסט פשוט (גוף text/plain של המייל)
//   title / direction / city / addressLine / out / back / amount / legs / warnings ...
// המטפל הנפרד לעורך התבניות (feature/email-center) יכול לצרוך `rows`, `itemRows` ו-`notice` כמו שהם.
//
// ערכי ברירת המחדל של הכיתוב והשעות (נווה יעקב) נמצאים כאן (DELIVERY_NOTICE_DEFAULTS), ונגזרים מהגדרות מערכת - לא קבועים בקוד:
//   delivery_notice_text, delivery_outbound_hours, delivery_return_hours (שורה חסרה = ברירת המחדל; שורה ריקה = הרכיב מוסתר).
//
// ברירת מחדל = ההתנהגות הקודמת: בלי ההגדרה delivery_as_item_row אין itemRows; בלי enable_deliveries (הגמ"ח הראשי) -> null תמיד.
import { addBusinessDays, rollForwardToWorkingDay, localDateFromKey, parseNonWorkingDaysSetting, NON_WORKING_DAYS_SETTING_KEY } from './businessDays';
import { getHebrewDateString, getHebrewWeekdayLabel, getIsraelDateKey } from './hebrewDate';

export const DELIVERY_AS_ITEM_ROW_KEY = 'delivery_as_item_row';

// מפתחות ההגדרות של הכיתוב + ברירות המחדל (הנוסח שאישר הבעלים לנווה יעקב, 12.10.2026)
export const DELIVERY_NOTICE_KEYS = Object.freeze({ text: 'delivery_notice_text', outboundHours: 'delivery_outbound_hours', returnHours: 'delivery_return_hours' });
export const DELIVERY_NOTICE_DEFAULTS = Object.freeze({
  text: 'שימו לב: אם הזמנתם משלוח אין צורך לבוא לגמ"ח, והמשלוחן ייצור אתכם קשר.',
  outboundHours: 'בשעות אחה"צ–ערב',
  returnHours: '10:00–13:00',
});

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

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * פיצול חיוב המשלוח לכיוונים - לתצוגה בלבד (הסכום הכולל לא משתנה): הלוך בלבד / חזור בלבד = כל הסכום לכיוון הזה; הלוך-חזור = חיוב
 * לכל כיוון לפי התיאור ("משלוח הלוך" / "משלוח חזור" - כפתורי "הוסף חיוב משלוח"), וחיוב משותף ("משלוח הלוך-חזור - עיר", כמות 2) - חצי לכל כיוון.
 * @returns {{out:number|null, back:number|null}}
 */
export function deliveryLegAmounts(obligations, direction) {
  const list = (obligations || []).filter(isDeliveryObligation);
  if (!list.length) return { out: null, back: null };
  const total = list.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const dir = direction || 'הלוך-חזור';
  if (dir === 'הלוך') return { out: round2(total), back: null };
  if (dir === 'חזור') return { out: null, back: round2(total) };
  let out = 0; let back = 0; let other = 0; let hasOut = false; let hasBack = false;
  for (const o of list) {
    const d = String(o.description || ''); const amt = Number(o.amount) || 0;
    const isOut = d.includes('הלוך') && !d.includes('חזור');
    const isBack = d.includes('חזור') && !d.includes('הלוך');
    if (isOut) { out += amt; hasOut = true; } else if (isBack) { back += amt; hasBack = true; } else other += amt;
  }
  if (other) { out += other / 2; back += other / 2; hasOut = true; hasBack = true; }
  if (hasOut && hasBack) { const o = round2(out); return { out: o, back: round2(out + back - o) }; } // שני הכיוונים מסתכמים בדיוק לחיוב
  return { out: hasOut ? round2(out) : null, back: hasBack ? round2(back) : null };
}

const bool = (v) => v === true || v === 'true';

/** מחלץ את ההגדרות הרלוונטיות ממערך [{key,value}] (getAllCachedSettings / תשובת /api/settings) או ממפה {key:value}. */
export function deliverySettingsFrom(settings) {
  const map = {};
  if (Array.isArray(settings)) for (const s of settings) { if (s && s.key) map[s.key] = s.value; }
  else if (settings && typeof settings === 'object') Object.assign(map, settings);
  const n = (v, d) => { const x = parseInt(v, 10); return Number.isNaN(x) ? d : x; };
  // טקסט: שורה חסרה = ברירת המחדל; שורה קיימת (גם ריקה) = הערך שלה, מנוקה מרווחים
  const txt = (key, def) => (Object.prototype.hasOwnProperty.call(map, key) && map[key] !== null && map[key] !== undefined ? String(map[key]).trim() : def);
  return {
    enabled: bool(map.enable_deliveries),
    asItemRow: bool(map[DELIVERY_AS_ITEM_ROW_KEY]),
    daysBefore: n(map.delivery_days_before, 1),
    daysAfter: n(map.delivery_days_after, 1),
    skipWeekend: bool(map.delivery_skip_weekends),
    nonWorking: parseNonWorkingDaysSetting(map[NON_WORKING_DAYS_SETTING_KEY] ?? null),
    noticeText: txt(DELIVERY_NOTICE_KEYS.text, DELIVERY_NOTICE_DEFAULTS.text),
    outboundHours: txt(DELIVERY_NOTICE_KEYS.outboundHours, DELIVERY_NOTICE_DEFAULTS.outboundHours),
    returnHours: txt(DELIVERY_NOTICE_KEYS.returnHours, DELIVERY_NOTICE_DEFAULTS.returnHours),
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

const withDot = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** כיתוב "שימו לב": הטקסט + שורה לכל כיוון שבהזמנה (הלוך / חזור) עם שעותיו. null כשאין מה להציג (הכול הוסתר בהגדרות). */
export function buildDeliveryNotice(direction, st) {
  const dir = direction || 'הלוך-חזור';
  const lines = [];
  if (dir !== 'חזור' && st.outboundHours) lines.push({ key: 'out', label: 'משלוח הלוך', hours: st.outboundHours, text: `משלוח הלוך: ${withDot(st.outboundHours)}` });
  if (dir !== 'הלוך' && st.returnHours) lines.push({ key: 'back', label: 'משלוח חזור', hours: st.returnHours, text: `משלוח חזור: ${withDot(st.returnHours)}` });
  if (!st.noticeText && !lines.length) return null;
  return { text: st.noticeText || '', lines, plain: [st.noticeText, ...lines.map((l) => l.text)].filter(Boolean) };
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

  const obligations = opts.obligations || order.obligations;
  const amount = deliveryChargeOf(obligations);
  const legAmounts = deliveryLegAmounts(obligations, direction);
  const warnings = [];
  if (!addressLine) warnings.push('no-address');
  if (amount === null) warnings.push('no-charge');

  const title = `משלוח ${direction}`;
  const rows = [{ key: 'type', label: 'משלוח', value: direction }];
  if (addressLine) rows.push({ key: 'address', label: 'כתובת המשלוח', value: addressLine });
  if (out) rows.push({ key: 'out', label: 'מועד המשלוח (הלוך)', value: out.text });
  if (back) rows.push({ key: 'back', label: 'מועד האיסוף (חזור)', value: back.text });
  // כשהמשלוח מוצג כשורות פריט המחיר מופיע שם, ולא פעמיים
  if (amount !== null && !st.asItemRow) rows.push({ key: 'cost', label: 'עלות משלוח', value: money(amount) });

  // שורה לכל כיוון: "משלוח הלוך" / "משלוח חזור" עם הכתובת, יום הכיוון והמחיר של אותו כיוון
  const legs = [];
  if (direction !== 'חזור') legs.push({ key: 'out', label: 'משלוח הלוך', dateText: out ? out.text : '', amount: legAmounts.out });
  if (direction !== 'הלוך') legs.push({ key: 'back', label: 'משלוח חזור', dateText: back ? back.text : '', amount: legAmounts.back });
  const itemRows = st.asItemRow
    ? legs.map((l) => ({ key: l.key, label: l.label, detail: [addressLine, l.dateText].filter(Boolean).join(' · '), amount: l.amount }))
    : [];

  const textLines = [`${title}${addressLine ? `: ${addressLine}` : ''}`];
  if (out) textLines.push(`מועד המשלוח (הלוך): ${out.text}`);
  if (back) textLines.push(`מועד האיסוף (חזור): ${back.text}`);
  if (amount !== null && !st.asItemRow) textLines.push(`עלות משלוח: ${money(amount)}`);

  // פירוט המשלוח בסיכום התשלום (תמיד, בלי קשר להגדרה): "משלוח הלוך ₪X" / "משלוח חזור ₪Y" - כבר כלולים ב"סה"כ לחיוב", כאן רק הצגה
  const summaryRows = legs.filter((l) => l.amount !== null && l.amount !== undefined).map((l) => ({ key: l.key, label: l.label, amount: l.amount }));

  const notice = buildDeliveryNotice(direction, st);

  return { show: true, direction, title, city, street, addressLine, out, back, amount, legs, asItemRow: st.asItemRow, rows, itemRows, summaryRows, notice, textLines, warnings };
}

/** שורת פריט כטקסט פשוט ("משלוח הלוך (כתובת · יום) - ₪60") לגוף text/plain. */
export function deliveryItemRowText(row) {
  if (!row) return '';
  return `${row.label}${row.detail ? ` (${row.detail})` : ''}${row.amount !== null && row.amount !== undefined ? ` - ${money(row.amount)}` : ''}`;
}

/** כל שורות הפריט של המשלוח כטקסט אחד מופרד בפסיקים (לשורת "פריטים:" בגוף הטקסט). */
export function deliveryItemRowsText(section) {
  return section && Array.isArray(section.itemRows) ? section.itemRows.map(deliveryItemRowText).join(', ') : '';
}
