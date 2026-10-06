// לוגיקה טהורה (בלי React/Prisma/רשת) לכפתורי "הוסף חיוב משלוח הלוך / חזור" בלשונית התשלומים של כרטיס ההזמנה הישן
// (components/orders/modern/ModernPaymentsManager.js) - מאחורי SystemSetting delivery_leg_button_marks_order
// (ברירת מחדל כבוי = הכפתורים רק מוסיפים שורת חיוב, כמו קודם). דיווחים org2 a6e5fb70, e2c072b7.
//
// העיקרון: הכפתור מסמן את ההזמנה כמשלוח (isDelivery + כיוון + עיר/כתובת) דרך אותו מסלול שמירה קיים (putOrder), והשרת
// ממשיך להיות הכותב היחיד של חיוב המשלוח האוטומטי (applyDeliveryCharge, lib/pricingEngine.js) - בלי כותב חיוב שני:
//   * recalculateOrderObligations מוחק בכל שמירה כל חיוב לא-ידני, ואז applyDeliveryCharge יוצר מחדש שורה אחת לפי שדות המשלוח
//     הנוכחיים (מחיר העיר x מספר הרגליים) - אבל רק אם אין בהזמנה אף חיוב "משלוח" פעיל.
//   * לכן כשכבר יש חיוב משלוח *ידני* (מהכפתורים הישנים / חיוב ידני), השרת לא ייצור שורה אוטומטית, והכפתור חייב להוסיף שורה
//     ידנית לרגל החדשה (planDeliveryLeg.needsManualLine) - אחרת הרגל לא תחויב. בכל מקרה אחר (אין שורה / יש שורה אוטומטית)
//     הכפתור לא מוסיף שורה, כדי שלא יהיה חיוב כפול.
import { isDeliveryAddressRequired } from './deliveryValidation';

export const LEG_OUT = 'הלוך';
export const LEG_BACK = 'חזור';
export const LEG_BOTH = 'הלוך-חזור';

const trimStr = (v) => String(v ?? '').trim();

/** הרגליים שכיוון משלוח מכסה. ערך ריק/לא מוכר = הלוך-חזור (כמו ברשימת המשלוחים ובברירת המחדל בכרטיס). */
export function legsOfDirection(direction) {
  if (direction === LEG_OUT) return [LEG_OUT];
  if (direction === LEG_BACK) return [LEG_BACK];
  return [LEG_OUT, LEG_BACK];
}

/** הרגליים שתיאור חיוב משלוח מכסה ("משלוח הלוך", "משלוח חזור - עיר", "משלוח הלוך-חזור - עיר"). לא-משלוח = []. */
export function legsOfDescription(description) {
  const d = String(description || '');
  if (!d.includes('משלוח')) return [];
  if (d.includes(LEG_BOTH)) return [LEG_OUT, LEG_BACK];
  const legs = [];
  if (d.includes(LEG_OUT)) legs.push(LEG_OUT);
  if (d.includes(LEG_BACK)) legs.push(LEG_BACK);
  return legs;
}

/** איחוד קבוצת רגליים לערך כיוון תקני של Order.deliveryDirection. */
export function directionFromLegs(legs) {
  const s = new Set(legs);
  if (s.has(LEG_OUT) && s.has(LEG_BACK)) return LEG_BOTH;
  return s.has(LEG_BACK) ? LEG_BACK : LEG_OUT;
}

/** חיובי משלוח פעילים (לא מחוקים) מתוך מערך החיובים של הכרטיס - כולל שורות תצוגה מקדימה (isPreview). */
export function activeDeliveryLines(obligations) {
  return (obligations || []).filter((o) => o && !o.isDeleted && String(o.description || '').includes('משלוח'));
}

/**
 * מה לחיצה על כפתור רגל (leg = 'הלוך' | 'חזור') עושה:
 *  - direction: הכיוון החדש = איחוד (כיוון ההזמנה אם כבר מסומנת כמשלוח) + (הרגליים שכבר מחויבות בשורות פעילות) + הרגל שנלחצה.
 *  - disabled: הרגל כבר מחויבת והזמנה כבר מסומנת כמשלוח - אין מה להוסיף.
 *  - markOnly: הרגל כבר מחויבת בשורה קיימת אבל ההזמנה לא מסומנת כמשלוח (המצב הבעייתי שדווח) - רק מסמנים, בלי שורה חדשה.
 *  - needsManualLine: קיימת שורת חיוב משלוח *ידנית* והרגל עוד לא מחויבת - השרת לא ייצור שורה אוטומטית אז מוסיפים שורה ידנית.
 */
export function planDeliveryLeg({ order, obligations, leg }) {
  const lines = activeDeliveryLines(obligations);
  const covered = new Set(lines.flatMap((o) => legsOfDescription(o.description)));
  const orderLegs = order?.isDelivery ? legsOfDirection(order.deliveryDirection) : [];
  const direction = directionFromLegs([...orderLegs, ...covered, leg]);
  const legCovered = covered.has(leg);
  const hasManualLine = lines.some((o) => !o.isPreview && o.isManual !== false);
  return {
    direction,
    disabled: legCovered && !!order?.isDelivery,
    markOnly: legCovered && !order?.isDelivery,
    needsManualLine: !legCovered && hasManualLine,
  };
}

/** מפתח עיר הלקוחה בטבלת delivery_price_by_city (אחרי trim, שם מדויק - כמו isDeliveryCityRequired), או null. */
export function priceTableCities(deliveryPriceByCity) {
  let map = {};
  try { map = JSON.parse(deliveryPriceByCity || '{}'); } catch { /* הגדרה פגומה = בלי ערים */ }
  return map && typeof map === 'object' && !Array.isArray(map) ? Object.keys(map) : [];
}

export function customerCityKey(customerCity, deliveryPriceByCity) {
  const cust = trimStr(customerCity);
  if (!cust) return null;
  return priceTableCities(deliveryPriceByCity).find((k) => trimStr(k) === cust) ?? null;
}

/** כתובת הלקוחה השמורה: { street, city, text }. */
export function customerSavedAddress(customer) {
  const street = [customer?.street, customer?.houseNum].map(trimStr).filter(Boolean).join(' ');
  const city = trimStr(customer?.city);
  return { street, city, text: [street, city].filter(Boolean).join(', ') };
}

/**
 * האם "לכתובת הרגילה של הלקוחה" (V) אפשרי: עיר הלקוחה בטבלת המחירים (אחרת עיר משלוח חובה) ויש לה רחוב שמור (אחרת למשלוח אין
 * לאן להגיע). אחרת השאלה נפתחת ישר ב"כתובת אחרת".
 */
export function canUseSavedAddress(customer, deliveryPriceByCity) {
  return !!customerCityKey(customer?.city, deliveryPriceByCity) && !!customerSavedAddress(customer).street;
}

/**
 * האם לשאול V/X. לא שואלים כשההזמנה כבר מסומנת כמשלוח ופרטיה שלמים (יש עיר, והכתובת/העיר עוברות את
 * validateDeliveryFields) - השאלה נשאלת פעם אחת להזמנה.
 */
export function needsAddressQuestion(order, customerCity) {
  if (!order?.isDelivery || !trimStr(order.deliveryCity)) return true;
  if (isDeliveryAddressRequired(order, customerCity) && !trimStr(order.deliveryAddress)) return true;
  return false;
}

/** ברירת המחדל של השאלה: V כשאפשר, אלא אם בהזמנה כבר יש כתובת/עיר שונות מהרגילה של הלקוחה (אז X ממולא מראש). */
export function defaultAddressChoice({ order, customer, canSaved }) {
  if (!canSaved) return 'other';
  const orderCity = trimStr(order?.deliveryCity);
  if (trimStr(order?.deliveryAddress) || (orderCity && orderCity !== trimStr(customer?.city))) return 'other';
  return 'saved';
}

/** שגיאה בעברית ל"כתובת אחרת" או null. */
export function validateOtherAddress({ city, address }) {
  if (!trimStr(city)) return 'יש לבחור עיר למשלוח';
  if (!trimStr(address)) return 'יש להקליד כתובת למשלוח';
  return null;
}

/** שדות ההזמנה שהכפתור קובע (נשלחים אחר כך ב-putOrder הרגיל). keep = רק כיוון. V = עיר הלקוחה + בלי כתובת חריגה; X = העיר והכתובת שהוקלדו. */
export function buildDeliveryFields({ direction, choice, customer, deliveryPriceByCity, city, address }) {
  // 'keep' = ההזמנה כבר מסומנת כמשלוח עם פרטים שלמים: רק מאחדים את הכיוון, העיר והכתובת נשארות כמו שהן.
  if (choice === 'keep') return { isDelivery: true, deliveryDirection: direction };
  if (choice === 'saved') {
    return {
      isDelivery: true,
      deliveryDirection: direction,
      deliveryCity: customerCityKey(customer?.city, deliveryPriceByCity) ?? trimStr(customer?.city),
      deliveryAddress: '',
    };
  }
  return { isDelivery: true, deliveryDirection: direction, deliveryCity: trimStr(city), deliveryAddress: trimStr(address) };
}

/** מחיר רגל אחת: טבלת ערים -> מחיר אחיד -> 50 - אותו סדר בדיוק כמו computeDeliveryObligationPreview / applyDeliveryCharge. */
export function deliveryLegPrice(city, deliveryPriceByCity, deliveryPrice) {
  let map = {};
  try { map = JSON.parse(deliveryPriceByCity || '{}'); } catch { /* ignore */ }
  let price = map && typeof map === 'object' ? map[city] : null;
  if (!price || Number(price) <= 0) price = deliveryPrice;
  if (!price || Number(price) <= 0) price = 50;
  return Number(price);
}

/**
 * הסכום שהלחיצה מייצרת, להצגה בחלון השאלה: adds = מה שנוסף בשורה ידנית (needsManualLine), total = חיוב המשלוח הכולל
 * כשהשרת מחשב (price x רגליים), 0 כשרק מסמנים.
 */
export function deliveryLegAmounts({ plan, city, deliveryPriceByCity, deliveryPrice }) {
  const perLeg = deliveryLegPrice(city, deliveryPriceByCity, deliveryPrice);
  if (plan.markOnly) return { perLeg, adds: 0, total: 0 };
  if (plan.needsManualLine) return { perLeg, adds: perLeg, total: perLeg };
  return { perLeg, adds: 0, total: perLeg * legsOfDirection(plan.direction).length };
}

/**
 * סימולציה טהורה של חיוב המשלוח אחרי שמירה (כלל השרת): אם יש שורת משלוח ידנית פעילה - רק הידניות נספרות; אחרת השרת יוצר שורה
 * אחת אוטומטית (price x רגליים) לפי שדות ההזמנה. משמש רק בבדיקות כדי להוכיח שאין חיוב כפול ושהסכום זהה לתווית הכפתור.
 */
export function simulateServerDeliveryTotal({ order, manualLines, deliveryPriceByCity, deliveryPrice }) {
  const manual = (manualLines || []).filter((o) => !o.isDeleted && String(o.description || '').includes('משלוח'));
  if (manual.length > 0) return manual.reduce((s, o) => s + Number(o.amount || 0), 0);
  if (!order?.isDelivery || !trimStr(order.deliveryCity)) return 0;
  return deliveryLegPrice(order.deliveryCity, deliveryPriceByCity, deliveryPrice) * legsOfDirection(order.deliveryDirection).length;
}
