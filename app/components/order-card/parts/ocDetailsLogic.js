// ocDetailsLogic.js — לוגיקה טהורה של לשוניות "פרטים" ו"משלוח" בכרטיס ההזמנה החדש (W2a). בלי React, בלי fetch, בלי DOM —
// נבדקת ב-node ב-3 אזורי זמן (scripts/order-card-tests/details.*.test.mjs) מול הקוד החי של הישן (components/orders/modern/
// ModernGeneralDetails.js, "MGD"), שנקרא כאורקל מתוך קובץ המקור עצמו. הישן לא מייבא את הקובץ הזה (PLAN §D.3: פורט, לא חילוץ).
//
// ===== מפת פורט (פונקציה כאן ← מקור בישן) =====
// withDateUpdates ← MGD:55-60 changeDates (חישוב eventDateHebrew רק כשנשלח eventDate בלי eventDateHebrew)
// eventTypeUpdates ← MGD:330-345 (לחצני "אירוע רגיל" / "אירוע חו"ל")
// rangeUpdates ← MGD:366-379 (onChange של HebrewDateRangePicker + applyTime: שמירת שעת היום הקודמת)
// shiftDateStr, extraDayUpdates ← MGD:68-83 (setExtraDay: הזזת from/to/return ביום, extraDay)
// spacingDefaultOf ← MGD:33/40-41 (inventory_buffer_days, ברירת מחדל 3 כשחסר/לא מספר)
// spacingDecision ← MGD:85-98 (applyCustomSpacing: אישור מנהל בכל הקטנה בפועל; ערך = ברירת המחדל נשמר כ-null)
// spacingAxis ← MGD:221-224 — שונה לפי הבעלים (W2A-SPACING): רגיל + 0..(ימים בין הזמנות − 1), בלי ערכים מעל "רגיל"
// extraDayVisible ← MGD:384 — שונה לפי הבעלים (AMB-13): בכל סוג אירוע כש-enable_rental_extension (בישן: רק isAbroad)
// deliverySettingsOf ← MGD:189-216 (enable_deliveries, delivery_allow_address_override, delivery_one_day_before_option, delivery_price_by_city)
// deliveryCityOptions ← MGD:217-218 + :474 (ערי המחירון, אחרת ערי הלקוחות; הערך הנוכחי תמיד ברשימה)
// deliveryFieldState ← MGD:219-220 + :471-491 (lib/deliveryValidation - אותן פונקציות בדיוק)
// NEW_CUSTOMER_EMPTY, newCustomerError, newCustomerBody ← MGD:25 + :138-159 (+ ת״ז כש-require_customer_id_number, ר' W2a-NOTES)
// gmailComplete ← MGD:612-620 ("השלם ל- @gmail.com")
// customerAddress ← MGD:164
// חדש (לא בישן): לוח החודש העברי הפנימי (A9) — hebMonthStartKey/hebMonthDays/calendarCells/monthTitle/dayTitle, ותאריכי טווח בתצוגה.

import { HDate, gematriya } from '@hebcal/core';
import { getHebrewDateString, getHebrewMonthName, getIsraelDateKey, getIsraelTodayKey, addDaysToDateKey } from '../../../../lib/hebrewDate';
import { isDeliveryAddressRequired, isDeliveryCityRequired } from '../../../../lib/deliveryValidation';

// ---------------------------------------------------------------------------------------------
// מפתחות תאריך (YYYY-MM-DD) — חשבון לוח שנה טהור, בלי תלות באזור הזמן של המכונה
// ---------------------------------------------------------------------------------------------
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isDateKey = (v) => typeof v === 'string' && KEY_RE.test(v);
const partsOf = (key) => { const m = KEY_RE.exec(key); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
// מפתח היום הישראלי של ערך שמור (ISO עם שעה, או YYYY-MM-DD) — '' לערך ריק/שגוי
export const dateKeyOf = (value) => (value ? (getIsraelDateKey(value) || '') : '');
// HDate של מפתח: Date מקומי בצהריים (HDate קורא את רכיבי התאריך המקומיים) - אותו יום בכל אזור זמן
const hdOf = (key) => { const p = partsOf(key); return p ? new HDate(new Date(p[0], p[1] - 1, p[2], 12)) : null; };
const keyOfHd = (hd) => { const g = hd.greg(); return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`; };
// 0=ראשון ... 6=שבת
export const weekdayOf = (key) => { const p = partsOf(key); return p ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : 0; };

// ---------------------------------------------------------------------------------------------
// תאריכים עבריים לתצוגה (בגרשיים, כמו בעיצוב) — לא נשמרים
// ---------------------------------------------------------------------------------------------
const WEEKDAY_FULL = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
export const WEEKDAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const monthNameOf = (hd) => getHebrewMonthName(hd.getMonth(), hd.isLeapYear());
// "כ״ז" (מספר היום בלוח)
export const hebDayLabel = (key) => { const hd = hdOf(key); return hd ? gematriya(hd.getDate()) : ''; };
// "כ״ז תשרי תשפ״ז"
export const hebDateLabel = (key) => { const hd = hdOf(key); return hd ? `${gematriya(hd.getDate())} ${monthNameOf(hd)} ${gematriya(hd.getFullYear())}` : ''; };
// "יום חמישי כ״ז תשרי תשפ״ז" (כותרת כרטיס האירוע ו-aria-label של יום בלוח; dayTitle בעיצוב)
export const dayTitle = (key) => (isDateKey(key) ? `${WEEKDAY_FULL[weekdayOf(key)]} ${hebDateLabel(key)}` : '');
// "תשרי תשפ״ז"
export const monthTitle = (startKey) => { const hd = hdOf(startKey); return hd ? `${monthNameOf(hd)} ${gematriya(hd.getFullYear())}` : ''; };

// ---------------------------------------------------------------------------------------------
// לוח החודש העברי (A9) — חודש עברי שלם, שורת ימים מראשון לשבת, תאים ריקים לפני היום הראשון
// ---------------------------------------------------------------------------------------------
export function hebMonthStartKey(key) {
  const hd = hdOf(isDateKey(key) ? key : getIsraelTodayKey());
  return keyOfHd(new HDate(1, hd.getMonth(), hd.getFullYear()));
}
export function hebMonthDays(startKey) {
  const hd = hdOf(startKey);
  const n = HDate.daysInMonth(hd.getMonth(), hd.getFullYear());
  return Array.from({ length: n }, (_, i) => addDaysToDateKey(startKey, i));
}
export function navMonth(startKey, dir) {
  if (dir > 0) { const days = hebMonthDays(startKey); return addDaysToDateKey(days[days.length - 1], 1); }
  return hebMonthStartKey(addDaysToDateKey(startKey, -1));
}
/** @returns {{blanks:number, days:string[]}} */
export function calendarCells(startKey) {
  return { blanks: weekdayOf(startKey), days: hebMonthDays(startKey) };
}

// ---------------------------------------------------------------------------------------------
// עריכת תאריכים — פורט מילולי של MGD (ראו מפת הפורט). כל פונקציה מחזירה את ה-updates שהישן העביר ל-changeDates/handleChange.
// ---------------------------------------------------------------------------------------------
// eventDateHebrew של ערך שנבחר: מפתח YYYY-MM-DD נקרא כיום מקומי (בישראל ובכל אזור זמן ≥ UTC זהה לישן, שקרא new Date('YYYY-MM-DD')
// = חצות UTC; באזור זמן שלילי הישן זז יום אחורה - כאן לא). ערך עם שעה - כמו הישן בדיוק.
export const hebrewOfPicked = (value) => {
  if (!value) return null;
  const p = isDateKey(value) ? partsOf(value) : null;
  return getHebrewDateString(p ? new Date(p[0], p[1] - 1, p[2], 12) : value);
};

/** MGD:55-60 changeDates — מחזיר את ה-updates אחרי השלמת eventDateHebrew (לא משנה את הקלט). */
export function withDateUpdates(updates) {
  const u = { ...updates };
  if (u.eventDate !== undefined && !u.eventDateHebrew) u.eventDateHebrew = u.eventDate ? hebrewOfPicked(u.eventDate) : null;
  return u;
}

export const isRangeEvent = (o) => !!(o && o.isAbroad);

/**
 * MGD:330-345 — מעבר לאירוע רגיל / חו"ל. null = אין שינוי (הישן: return כשהמצב כבר נבחר).
 * AMB-13 (הבעלים): "יום השכרה נוסף" זמין בכל סוג אירוע, ולכן extraDay נשמר במעבר (קודם: אופס, סקירת W2a סעיף 1, כי היה מוסתר באירוע רגיל).
 * במעבר לחו"ל אין עדיין לקיחה/החזרה והגלולות 'לפני/אחרי' כבויות עד שיבחרו התאריכים; כשיבחר טווח - rangeUpdates מחיל את ההזזה (ר' שם).
 */
export function eventTypeUpdates(order, toAbroad) {
  const abroad = isRangeEvent(order);
  if (toAbroad === abroad) return null;
  return toAbroad
    ? withDateUpdates({ isAbroad: true, eventDate: null, eventDateHebrew: null })
    : withDateUpdates({ isAbroad: false, fromDate: null, toDate: null, returnDate: null });
}

/** MGD:367-375 applyTime — היום שנבחר + שעת היום של הערך הקודם (או של עכשיו), כ-ISO. */
export function applyTime(newDateStr, prevDateStr, now = new Date()) {
  if (!newDateStr) return newDateStr;
  const p = isDateKey(newDateStr) ? partsOf(newDateStr) : null;
  const d = p ? new Date(p[0], p[1] - 1, p[2]) : new Date(newDateStr);
  const prev = prevDateStr ? new Date(prevDateStr) : null;
  const ref = (prev && !isNaN(prev.getTime())) ? prev : now;
  d.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
  return d.toISOString();
}

/**
 * MGD:366-379 — טווח לקיחה/החזרה (start/end = YYYY-MM-DD, end יכול להיות ריק).
 * תיקון מכוון (סקירת W2a, סעיף 2): בחירה מחדש של טווח שכבר הושלם = טווח נקי, extraDay מתאפס (הישן השאיר אותו בלי ההזזה, וביטולו
 * אחר כך קיצר יום). חריג (AMB-13): כשהדגל נשמר ממעבר סוג אירוע - עדיין אין טווח שלם בהזמנה - הטווח הראשון שהושלם הוא הבסיס
 * ו-extraDay מוחל עליו (הזזה ביום) במקום להיעלם בשקט; עד שהושלם הטווח (בחירת התחלה בלבד) הדגל נשאר כמות שהוא, בלי הזזה.
 */
export function rangeUpdates(order, start, end, now = new Date()) {
  const newFrom = applyTime(start, order.fromDate, now);
  const newTo = applyTime(end, order.toDate || order.returnDate, now);
  const hadFullRange = !!(order.fromDate && (order.toDate || order.returnDate));
  const keep = order.extraDay && !hadFullRange;
  const base = { fromDate: newFrom, toDate: newTo, returnDate: newTo, eventDate: newFrom };
  if (!keep) return withDateUpdates({ ...base, extraDay: null });
  const shifted = extraDayUpdates({ ...order, ...base, extraDay: null }, order.extraDay); // null כשהטווח עוד לא שלם
  return withDateUpdates(shifted ? { ...base, ...shifted } : base);
}

/** MGD:68-73 (מילולי) */
export const shiftDateStr = (dateStr, deltaDays) => {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString();
};

// יום נוסף אפשרי רק כשיש תאריכים להזיז / לחייב עליהם (אחרת התוספת הייתה מחויבת בלי יום בפועל - סקירת W2a, סעיף 2):
// באירוע עם טווח - לקיחה והחזרה; באירוע רגיל (AMB-13) - תאריך האירוע.
export const extraDayReady = (order) => {
  if (!order) return false;
  return isRangeEvent(order) ? !!(order.fromDate && (order.toDate || order.returnDate)) : !!order.eventDate;
};

/**
 * MGD:74-83 setExtraDay — null = אין שינוי (גם: בחירת יום נוסף בלי התאריכים הנדרשים). newValue: null | 'before' | 'after'.
 * באירוע עם טווח הבחירה מזיזה את הלקיחה/ההחזרה ביום. באירוע רגיל (AMB-13) אין טווח לשמור: הדגל בלבד (מחיר 50% במנוע; הטיפול בשרת -
 * ר' REQUESTS-W0 בסעיף AMB-13).
 */
export function extraDayUpdates(order, newValue) {
  const current = order.extraDay || null;
  if (current === newValue) return null;
  if (newValue && !extraDayReady(order)) return null;
  if (!isRangeEvent(order)) return withDateUpdates({ extraDay: newValue });
  let { fromDate, toDate, returnDate } = order;
  if (current === 'before') fromDate = shiftDateStr(fromDate, 1);
  if (current === 'after') { toDate = shiftDateStr(toDate, -1); returnDate = shiftDateStr(returnDate, -1); }
  if (newValue === 'before') fromDate = shiftDateStr(fromDate, -1);
  if (newValue === 'after') { toDate = shiftDateStr(toDate, 1); returnDate = shiftDateStr(returnDate, 1); }
  return withDateUpdates({ fromDate, toDate, returnDate, extraDay: newValue });
}

// AMB-13 (הבעלים: "בכל אירוע"): יום נוסף כש-enable_rental_extension, בכל סוג אירוע (order נשאר בחתימה לתאימות)
export const extraDayVisible = (settings) => !!(settings && settings.enableRentalExtension);
export const EXTRA_DAY_OPTIONS = [[null, 'ללא'], ['before', 'יום לפני'], ['after', 'יום אחרי']];

// ---------------------------------------------------------------------------------------------
// ציפוף ימים מיוחד (R18)
// ---------------------------------------------------------------------------------------------
/** MGD:33/40-41: inventory_buffer_days (parseInt), אחרת 3. settings = oc.settings (get) או מפה key→value. */
export function spacingDefaultOf(settings) {
  const raw = settings && typeof settings.get === 'function' ? settings.get('inventory_buffer_days', null) : (settings ? settings.inventory_buffer_days : null);
  const n = parseInt(raw, 10);
  return raw !== null && raw !== undefined && !isNaN(n) ? n : 3;
}
export const hasCustomSpacing = (order, hide) => !hide && order.customSpacing !== null && order.customSpacing !== undefined;
/**
 * W2A-SPACING (הבעלים): הציר = "רגיל" + 0..(gap-1) כש-gap = ימים בין הזמנות (inventory_buffer_days, ברירת מחדל 3): gap=3 → רגיל/0/1/2.
 * אין ערכים מעל "רגיל" (אין ציפוף מוגדל). order שמור עם ערך >= gap (ישן: 4/5 או gap שהוקטן) מוצג כערך הנוכחי - גלולה נוספת - ולא
 * משתנה בשקט (שאלה פתוחה לבעלים, W2a-NOTES). הקריאה הישנה spacingAxis(def, selected) נשארת תואמת.
 */
export function spacingAxis(defaultSpacing, selected) {
  const gap = Math.max(0, defaultSpacing);
  const axis = Array.from({ length: gap }, (_, i) => i);
  if (selected !== null && selected !== undefined && Number.isInteger(selected) && selected >= 0 && !axis.includes(selected)) axis.push(selected);
  return axis;
}
/** הערך השמור גבוה/שווה ל-gap (לא ניתן לבחירה מחדש; מסומן בגלולה) */
export const spacingIsLegacy = (defaultSpacing, selected) => selected !== null && selected !== undefined && selected >= Math.max(0, defaultSpacing);
/**
 * MGD:85-98 applyCustomSpacing. spacing: null = "רגיל".
 * @returns {{needsApproval:boolean, valueToStore:number|null}}
 */
export function spacingDecision(order, spacing, defaultSpacing) {
  const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : defaultSpacing;
  const newSpacing = (spacing !== null && spacing !== undefined) ? spacing : defaultSpacing;
  const valueToStore = (spacing !== null && spacing !== undefined && spacing === defaultSpacing) ? null : spacing;
  return { needsApproval: newSpacing < prevSpacing, valueToStore };
}

// ---------------------------------------------------------------------------------------------
// לקוח (R19/R20/A7)
// ---------------------------------------------------------------------------------------------
const nonEmpty = (v) => v !== null && v !== undefined && String(v).trim() !== '';
export const customerName = (c) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : '');
/** MGD:164 */
export const customerAddress = (c) => (c ? [c.street && `${c.street} ${c.houseNum || ''}`.trim(), c.city].filter(Boolean).join(', ') : '');
// ת״ז מוצגת (A7) תמיד במלואה (W2A-ID, הכרעת הבעלים: בלי מסיכת 3 הספרות האחרונות גם כשאימות הת״ז לעריכה דולק).
export const zeoutDisplay = (zeout) => String(zeout || '').trim();
// AMB-10 (הבעלים): "חסר" ליד ת״ז ריקה לפי require_customer_id_number בלבד (אימות הת״ז לעריכה בתוקף רק כשהיא דלוקה - parseSettings)
export const zeoutRequired = (settings) => !!(settings && settings.requireCustomerIdNumber);

export const NEW_CUSTOMER_EMPTY = Object.freeze({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });
/** MGD:139-142 (+ ת״ז כש-require_customer_id_number: השרת דוחה בלעדיה, ר' app/api/customers/route.js:145) */
export function newCustomerError(form, settings) {
  if (!form.firstName || !form.lastName || !form.phone1 || !form.email) return 'יש למלא שם פרטי, משפחה, טלפון ודוא"ל';
  if (settings && settings.requireCustomerIdNumber && !String(form.zeout || '').trim()) return 'יש למלא תעודת זהות';
  return null;
}
/** גוף POST /api/customers: בדיוק newCustomer של הישן (MGD:147), + zeout רק כשההגדרה דורשת ת״ז. */
export function newCustomerBody(form, settings) {
  const body = { firstName: form.firstName, lastName: form.lastName, phone1: form.phone1, email: form.email, city: form.city, street: form.street, houseNum: form.houseNum };
  if (settings && settings.requireCustomerIdNumber) body.zeout = String(form.zeout || '').trim();
  return body;
}
/** MGD:612-620: הלחצן מוצג כשאין "@"; מוסיף "@gmail.com" */
export const gmailCompletable = (email) => !email || !email.includes('@');
export const gmailComplete = (email) => (email || '') + '@gmail.com';
/** MGD:132-136 selectCustomer — ה-updates להזמנה */
export const customerUpdates = (c) => ({ customerId: c.id, customer: c });

// ---------------------------------------------------------------------------------------------
// משלוח (R21)
// ---------------------------------------------------------------------------------------------
export const DELIVERY_DIRECTIONS = [['הלוך', 'arrr'], ['חזור', 'arrl'], ['הלוך-חזור', 'arrlr']];
export const DEFAULT_DIRECTION = 'הלוך-חזור';
/** MGD:199-216 (=== 'true'; JSON לא תקין = בלי ערים) */
export function deliverySettingsOf(settings) {
  const get = (k) => (settings && typeof settings.get === 'function' ? settings.get(k, null) : null);
  let priceByCity = {};
  try { priceByCity = JSON.parse(get('delivery_price_by_city') || '{}') || {}; } catch { priceByCity = {}; }
  if (typeof priceByCity !== 'object' || Array.isArray(priceByCity)) priceByCity = {};
  return {
    enabled: get('enable_deliveries') === 'true',
    allowAddressOverride: get('delivery_allow_address_override') === 'true',
    oneDayBeforeOption: get('delivery_one_day_before_option') === 'true',
    priceByCity,
  };
}
/** MGD:217-218 + :474 — הערך הנוכחי (אם יש) ראשון, ואחריו ערי המחירון או ערי הלקוחות (בלי כפילויות) */
export function deliveryCityOptions(priceByCity, fallbackCities, current) {
  const priceCities = Object.keys(priceByCity || {});
  const base = priceCities.length ? priceCities : (fallbackCities || []);
  return [...new Set([...(current ? [current] : []), ...base])];
}
/** MGD:219-220 + :471-491 — אותן פונקציות של lib/deliveryValidation, ואותם טקסטים */
export function deliveryFieldState(order, customer, ds) {
  const priceCities = Object.keys((ds && ds.priceByCity) || {});
  const cityRequired = isDeliveryCityRequired(order, customer?.city, priceCities);
  const addressRequired = isDeliveryAddressRequired(order, customer?.city);
  return {
    cityRequired,
    addressRequired,
    showAddress: !!(ds && ds.allowAddressOverride) || addressRequired,
    cityMsg: cityRequired && !String(order.deliveryCity || '').trim() ? 'עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח.' : '',
    addressMsg: addressRequired && !String(order.deliveryAddress || '').trim() ? 'עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח.' : '',
  };
}
/**
 * שדה העיר עם הצעות = רשימה סגורה (R21, כמו ה-select של הישן ושדה ההצעות של העיצוב): ערך מהרשימה נקלט; '' = "בחר עיר…" של הישן;
 * כל טקסט אחר → null (השדה חוזר לערך התקף האחרון).
 */
export function resolveCityInput(text, options) {
  const v = String(text || '').trim();
  if (!v) return '';
  return (options || []).includes(v) ? v : null;
}
export const filterSuggestions = (options, q) => { const s = String(q || '').trim(); return s ? (options || []).filter(o => o.includes(s)) : (options || []); };
