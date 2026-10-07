// לוגיקה טהורה (בלי React) של צורות הטופס של האשף החדש - אשף שלבים (wizard) / טופס רציף בעמוד אחד (continuous, ההגדרה new_order_layout).
// כל מה שמשותף לשתי הצורות יושב כאן ולא משוכפל: טקסטי הסיכום של פסי ההתקדמות, פעולת "המשך" של כל שלב (אותם תנאי כיבוי ואותה קריאה ל-ctl.go),
// הקביעה אילו שלבים מוצגים, מצב ההתקדמות של הפס הדק, וגלילה חלקה לשלב. תנאי הנעילה עצמם - NL.stepGate (newOrderLogic) - מקור יחיד גם ל-go().
import { hebrewParts } from '../schedule/hebrewCalendar';
import { STEP_KEYS, deliveryStepVisibility, getCustomerFullName, moneyTxt } from './newOrderLogic';

export const sectionDomId = (key) => `noSec-${key}`;

export const shortHeb = (k) => { if (!k) return ''; const h = hebrewParts(k); return `${h.dl} ${h.m}`; };

// הפרט שמולא של כל שלב (מתחת לפס שהושלם) - לשני הפסים (wizard / רציף)
export function stepSummaries(ctl) {
  const o = ctl.order;
  const c = o.selectedCustomer;
  return {
    customer: o.customerId ? getCustomerFullName(c) : '',
    dates: o.isAbroad ? (o.fromDate && o.toDate ? `${shortHeb(o.fromDate)} — ${shortHeb(o.toDate)}` : '') : shortHeb(o.eventDate),
    delivery: o.isDelivery ? `${o.deliveryDirection} · ${o.deliveryCity || (c && c.city) || ''}` : (o.isPhoneOrder ? 'הזמנה טלפונית' : 'ללא משלוח'),
    items: ctl.activeItems.length ? `${ctl.activeItems.length} פריטים · ${moneyTxt(ctl.totalAmount)}` : '',
    summary: 'הושלם',
    payment: ctl.totalPaid > 0 ? `שולם ${moneyTxt(ctl.totalPaid)}` : 'רישום תשלום וסיום',
  };
}

// פעולת "המשך" של שלב (אשף: שורת הניווט; רציף: תחתית כל גוש) - [תווית, כבוי, פעולה]. null לשלב התשלום (שם "סיום ויצירת ההזמנה").
// skipDelivery: בטופס הרציף שלב המשלוח לא מוצג כשהוא כבוי בהגדרות - "המשך" מהתאריכים עובר ישר לפריטים (אותו go() עם אינדקס הפריטים)
export function stepNextAction(ctl, key, { skipDelivery = false } = {}) {
  const iOf = (k) => STEP_KEYS.indexOf(k);
  const table = {
    customer: ['המשך', !ctl.order.customerId, ctl.proceedToStep2],
    dates: skipDelivery ? ['המשך לבחירת פריטים', !ctl.datesFilled, () => ctl.go(iOf('items'))] : ['המשך למשלוח', !ctl.datesFilled, () => ctl.go(iOf('delivery'))],
    delivery: ['המשך לבחירת פריטים', !!ctl.deliveryError, () => ctl.go(iOf('items'))],
    items: ['המשך לסיכום', ctl.activeItems.length === 0, () => ctl.go(iOf('summary'))],
    summary: ['המשך לתשלום', false, () => ctl.go(iOf('payment'))],
  };
  return table[key] || null;
}

// אילו שלבים מוצגים בטופס הרציף. שלב המשלוח מכיל גם את "אופן ההזמנה" (טלפונית / סניף) ולכן נשאר כשאחד משני השערים הקיימים
// (deliveryStepVisibility: showMode / showDelivery) דולק; כששניהם כבויים השלב היה רק הודעה "משלוח וסניפים כבויים" - לא מוצג בכלל
export function visibleSectionKeys(settings) {
  const v = deliveryStepVisibility(settings || {});
  return STEP_KEYS.filter((k) => k !== 'delivery' || v.showMode || v.showDelivery);
}

// מצב ההתקדמות של הפס הדק בטופס הרציף - לפי הנתונים בלבד (לא לפי מיקום הגלילה): done / cur (הראשון שעוד לא הושלם) / fut
// done: { key: boolean } - מה הושלם לפי נתוני ההזמנה; saved: ההזמנה נשמרה (הכול הושלם)
export function sectionProgress(keys, done, saved) {
  let curSeen = false;
  return keys.map((key) => {
    if (saved || done[key]) return { key, state: 'done' };
    if (!curSeen) { curSeen = true; return { key, state: 'cur' }; }
    return { key, state: 'fut' };
  });
}

// מה נחשב "הושלם" לפס: לקוח - נבחר ואושר; תאריכים - מולאו; משלוח - רשות: הושלם כשנפתח והשדות תקינים; פריטים - יש פריט; סיכום - אין מה להשלים
// (נחשב כשהפריטים הושלמו); תשלום - נשמר. gate = (key) => ({open}) מה-controller (אותם תנאי נעילה).
export function sectionDoneFlags(ctl, gate) {
  const itemsDone = ctl.activeItems.length > 0;
  return {
    customer: !!ctl.order.customerId && gate('dates').open,
    dates: ctl.datesFilled && gate('dates').open,
    delivery: gate('delivery').open,
    items: itemsDone && gate('items').open,
    summary: itemsDone && gate('summary').open,
    payment: !!ctl.saved,
  };
}

// גלילה חלקה לגוש (כבוד ל-prefers-reduced-motion). מחזירה false כשהגוש לא קיים בעמוד (אשף) - הקורא נופל לגלילה למעלה
export function scrollToSection(key) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const el = document.getElementById(sectionDomId(key));
  if (!el || !el.scrollIntoView) return false;
  const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  try { el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); } catch { return false; }
  return true;
}
