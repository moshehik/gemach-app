// lib/schedule/orderStages.js — "שלבי ההזמנה" של הזמנה אחת (כרטיס ההזמנה החדש, לשונית היסטוריה, החלטת הבעלים A5:
// "רק השלבים כפי שיוגדר במסך לוז"). פונקציה טהורה: בלי prisma, בלי fetch - הקלט נטען ב-GET /api/orders/[id]/journal.
//
// אותם כללים בדיוק כמו הלו״ז היומי (lib/schedule/loaders.js + lib/deliveries.js), מנקודת המבט ההפוכה: הלו״ז שואל "אילו
// הזמנות ביום X בשלב S", כאן שואלים "באיזה יום ההזמנה הזו מופיעה בכל שלב". הקבצים הקיימים של הלו״ז לא נערכו (loaders.js
// מייבא prisma ולכן לא מיובא לכאן) - הכללים הקטנים שלו משוכפלים כאן עם הפניה, והבדיקה history.stages.test.mjs נועלת אותם:
//   יום התחלה אפקטיבי   חו״ל / אמצע שבוע: fromDate ‖ eventDate, אחרת eventDate        (loaders.effectiveStartKey)
//   תיקונים / הכנה / איסוף   יום ההתחלה + offset ימי עסקים (schedule_stage_<key>_days)  (eventStageKeySets ההופכי)
//   תיקונים              רק כשיש פריט עם תיקון (itemHasAlteration)                      (classifyEventOrder)
//   איסוף מקומי           רק כשאין משלוח הלוך (isDeliveryOut)                              (classifyEventOrder)
//   משלוח הלוך / חזור     eventDate ∓ delivery_days_before/after (יום לפני = 1), skipWeekend לפי delivery_skip_weekends
//                         (lib/deliveries.js dispatchDates, אותו addBusinessDays)
//   החזרה ידנית           toDate ‖ returnDate ‖ אירוע + offset, מגולגל ליום עובד           (loaders.returnDueKeys)
//   שלב כבוי בהגדרות (או משלוחים/תיקונים כבויים) - לא מוצג, כמו בלו״ז.
// "בוצע": סימון בלו״ז (ScheduleStageMark, done=true; עדיפות לסימון של אותו יום, אחרת האחרון) או העובדה הקיימת בפריטים -
// תיקונים: כל פריטי התיקון alterationDone; איסוף / משלוח הלוך: כל הפריטים נלקחו; החזרה / משלוח חזור: כל הפריטים הוחזרו
// (במשלוחים הלו״ז עצמו בלי שדה קיים - כאן הפריטים כן נחשבים, כמו בעיצוב: "anyOut" / "allIn"). אירוע: מידע ("התקיים" אחרי היום).
// סימון מהכרטיס: רק לשלב "הכנה" (העיצוב + AMB-08), דרך POST /api/schedule/marks הקיים.

import { addBusinessDays as bdAdd, rollForwardToWorkingDay as bdRoll } from '@/lib/businessDays';
import { getHebrewDateString, getHebrewWeekdayLabel, getHebrewWeekdayFullName } from '@/lib/hebrewDate';
import { isDeliveryOut, isDeliveryReturn } from './deliveryDirection';
import { isAlterationEstimated } from '@/lib/alterationEstimate';

const IL_TZ = 'Asia/Jerusalem';
export const ORDER_STAGE_DEFS = {
  order: { label: 'הזמנה', icon: 'file', number: 1, infoOnly: true },
  repair: { label: 'תיקונים', icon: 'scissors', number: 2 },
  prep: { label: 'הכנה', icon: 'bag', number: 4 },
  dout: { label: 'משלוח הלוך', icon: 'truck', number: 5 },
  pick: { label: 'איסוף מקומי', icon: 'userck', number: 6 },
  event: { label: 'אירוע', icon: 'gift', number: 7, infoOnly: true },
  manret: { label: 'החזרה ידנית', icon: 'undo', number: 8 },
  dback: { label: 'משלוח חזור', icon: 'truck', number: 9 },
};
// השלב היחיד שמסומן מהכרטיס (העיצוב: "סמן הכנה בוצעה"; שאר השלבים מסומנים בלו״ז/בסריקה)
export const CARD_MARKABLE_STAGES = ['prep'];

export function dayKeyOf(instant) {
  if (!instant) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: IL_TZ });
}

// חצות מקומית של המפתח - לעזרי התאריך העברי הקיימים (getDay/HDate מקומיים) - אותו יום בכל אזור זמן
function localNoon(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** תוויות עבריות ליום (בלי תאריך לועזי): { dayKey, he:'כז תשרי תשפ"ז', heShort:'כז תשרי', wd:"יום ה'", wdFull:'יום חמישי' } */
export function dayLabels(key) {
  if (!key) return null;
  const he = getHebrewDateString(localNoon(key)) || '';
  const parts = he.split(' ');
  return { dayKey: key, he, heShort: parts.length > 2 ? parts.slice(0, -1).join(' ') : he, wd: getHebrewWeekdayLabel(localNoon(key)), wdFull: getHebrewWeekdayFullName(localNoon(key)) };
}

export const itemHasAlteration = (item) => {
  if (!item) return false;
  if ((item.neckAlteration || 0) > 0) return true;
  if ((item.sleeveAlteration || 0) > 0) return true;
  const len = item.lengthAlteration;
  return len !== null && len !== undefined && !['', 'null', '0'].includes(String(len));
};
const itemTaken = (it) => !!(it && (it.isTaken || it.takenDate));
const itemReturned = (it) => !!(it && (it.isReturned || it.returnDate));
const isCustomPeriod = (o) => !!o.isAbroad;

export function effectiveStartKey(order) {
  return dayKeyOf(isCustomPeriod(order) ? (order.fromDate || order.eventDate) : order.eventDate);
}
export function effectiveEndKey(order) {
  return dayKeyOf(isCustomPeriod(order) ? (order.toDate || order.fromDate || order.eventDate) : order.eventDate);
}
export function returnDueKey(order, { offset = 1, nonWorkingDays = null } = {}) {
  const explicit = dayKeyOf(order.toDate) || dayKeyOf(order.returnDate);
  const eventKey = dayKeyOf(order.eventDate);
  const raw = explicit || (eventKey ? bdAdd(eventKey, offset, nonWorkingDays) : null);
  return raw ? bdRoll(raw, nonWorkingDays) : null;
}

function pickMark(marks, stageKey, dayKey) {
  const list = (marks || []).filter((m) => m && m.stageKey === stageKey);
  const exact = list.find((m) => m.dayKey === dayKey);
  if (exact) return exact.done ? exact : null; // בוטל באותו יום = לא בוצע (אלא אם העובדה בפריטים אומרת אחרת)
  const done = list.filter((m) => m.done).sort((a, b) => new Date(b.markedAt || 0) - new Date(a.markedAt || 0));
  return done[0] || null;
}

/**
 * @param {object} order   Order + items (isDeleted, alterations, isTaken/takenDate, isReturned/returnDate/returnedOk)
 * @param {object} ctx
 * @param {object} ctx.schedule   resolveScheduleSettings() (lib/schedule/settings.js): stages{key:{enabled,offset}}, nonWorkingDays
 * @param {{daysBefore?:number, daysAfter?:number, skipWeekends?:boolean}} [ctx.delivery]  delivery_days_before/after, delivery_skip_weekends
 * @param {Array} [ctx.marks]   ScheduleStageMark rows of the order {stageKey, dayKey, done, outcome, markedAt, markedById?, markedBy? (name)}
 * @param {string} ctx.todayKey Israel day 'YYYY-MM-DD'
 * @param {boolean} [ctx.closeWhenReturned]  כרטיס ההזמנה (יומן): הזמנה שהוחזרה במלואה (שלב החזרה / משלוח חזור בוצע, או כל הפריטים הוחזרו) או שבוטלה
 *        אין בה "שלב נוכחי" ואין בה פעולה ממתינה - שלבים שלא בוצעו מסומנים closedByReturn (לא markable, לא current). ברירת מחדל כבוי: ההתנהגות
 *        של ההנחיות הקיימות לא משתנה. החזרה חלקית אינה סוגרת.
 * @param {boolean} [ctx.inferPrepWhenTaken]  כרטיס ההזמנה (יומן + ציר, בעלים 2026-10-06): "הכנה" ו"תיקונים" נחשבים בוצעו (doneVia 'inferred', לא markable) כשפריט פעיל נלקח / הוחזר או כששלב איסוף /
 *        משלוח הלוך / החזרה / משלוח חזור בוצע - אי אפשר לקחת שמלה בלי שהוכנה. הלו״ז היומי לא משתמש באפשרות (שורת סימון בפועל נכתבת בלקיחה - lib/schedule/autoPrepMark.js).
 * @returns {{stages: Array<object>, currentKey: string|null}}
 */
export function computeOrderStages(order, { schedule, delivery = {}, marks = [], todayKey, closeWhenReturned = false, inferPrepWhenTaken = false } = {}) {
  const st = (schedule && schedule.stages) || {};
  const nwd = (schedule && schedule.nonWorkingDays) || null;
  const on = (k) => !!(st[k] && st[k].enabled);
  const off = (k, def) => (st[k] && Number.isFinite(st[k].offset) ? st[k].offset : def);
  const items = (order.items || []).filter((it) => !it.isDeleted);
  const startKey = effectiveStartKey(order);
  const endKey = effectiveEndKey(order) || startKey;
  const eventKey = dayKeyOf(order.eventDate);
  const daysBefore = Number.isFinite(delivery.daysBefore) ? delivery.daysBefore : 1;
  const daysAfter = Number.isFinite(delivery.daysAfter) ? delivery.daysAfter : 1;
  const dopts = { skipWeekend: !!delivery.skipWeekends };
  const out = [];
  const add = (key, dayKey, extra = {}) => out.push({ key, ...ORDER_STAGE_DEFS[key], infoOnly: !!ORDER_STAGE_DEFS[key].infoOnly, dayKey, day: dayLabels(dayKey), markable: CARD_MARKABLE_STAGES.includes(key), ...extra });

  // 1 הזמנה - תמיד (גם כשהשלב כבוי בלו״ז: זו נקודת ההתחלה של הציר)
  add('order', dayKeyOf(order.orderDate), { done: true, doneVia: 'info' });

  const factOr = (key, dayKey, fact, factOutcome) => {
    const m = pickMark(marks, key, dayKey);
    if (m) return { done: true, doneVia: 'mark', mark: { dayKey: m.dayKey, markedAt: m.markedAt || null, markedById: m.markedById || null, markedBy: m.markedBy || null, outcome: m.outcome || null }, outcome: m.outcome || factOutcome || null };
    if (fact) return { done: true, doneVia: 'fact', mark: null, outcome: factOutcome || null };
    return { done: false, doneVia: null, mark: null, outcome: null };
  };

  if (startKey) {
    const alt = items.filter(itemHasAlteration);
    if (on('repair') && alt.length) {
      const k = bdAdd(startKey, off('repair', 0), nwd);
      const repairState = factOr('repair', k, alt.every((it) => !!it.alterationDone));
      // בוצע (משוער): כל התיקונים בוצעו ולפחות אחד נרשם אוטומטית בלקיחה (lib/alterationEstimate.js) - בלי סימון אדם בלו״ז
      add('repair', k, { ...repairState, estimated: repairState.doneVia === 'fact' && alt.some((it) => isAlterationEstimated(it)) });
    }
    if (on('prep')) {
      const k = bdAdd(startKey, off('prep', -3), nwd);
      add('prep', k, factOr('prep', k, false));
    }
    const allTaken = items.length > 0 && items.every(itemTaken);
    if (isDeliveryOut(order)) {
      if (on('dout') && eventKey) {
        const k = bdAdd(eventKey, -(order.deliveryOneDayBefore ? 1 : daysBefore), nwd, dopts);
        add('dout', k, factOr('dout', k, allTaken));
      }
    } else if (on('pick')) {
      const k = bdAdd(startKey, off('pick', -2), nwd);
      add('pick', k, factOr('pick', k, allTaken));
    }
    if (on('event')) {
      add('event', startKey, { done: !!todayKey && endKey < todayKey, doneVia: 'info', endKey: endKey !== startKey ? endKey : null, endDay: endKey !== startKey ? dayLabels(endKey) : null });
    }
    const allIn = items.length > 0 && items.every(itemReturned);
    const condition = allIn ? (items.every((it) => it.returnedOk) ? 'ok' : 'not_ok') : null;
    if (isDeliveryReturn(order)) {
      if (on('dback') && eventKey) {
        const k = bdAdd(eventKey, daysAfter, nwd, dopts);
        add('dback', k, factOr('dback', k, allIn, condition));
      }
    } else if (on('manret')) {
      const k = returnDueKey(order, { offset: off('manret', 1), nonWorkingDays: nwd });
      if (k) add('manret', k, factOr('manret', k, allIn, condition));
    }
  }
  // ציר כרונולוגי: לפי היום, ובאותו יום לפי מספר השלב בלו״ז (תיקונים ביום האירוע לפני האירוע; ההזמנה תמיד ראשונה)
  out.sort((a, b) => (a.key === 'order' ? -1 : b.key === 'order' ? 1 : 0) || String(a.dayKey).localeCompare(String(b.dayKey)) || a.number - b.number);
  // הכנה / תיקונים שנגזרו מהלקיחה (בעלים 2026-10-06): פריט פעיל נלקח / הוחזר, או שלב איסוף / משלוח הלוך / החזרה / משלוח חזור בוצע
  if (inferPrepWhenTaken && !order.isDeleted) {
    const movedOn = items.some((it) => itemTaken(it) || itemReturned(it)) || out.some((s) => ['pick', 'dout', 'manret', 'dback'].includes(s.key) && s.done);
    if (movedOn) {
      for (const s of out) {
        // סימון שבוטל ע"י אדם (שורת done=false לשלב) גובר על ההסקה: השלב נשאר "טרם בוצע" (עם לחצן הסימון) - כמו בלו״ז; autoMarkPrepForOrder לא יוצר סימון חדש מעליו
        const cancelledByHuman = (marks || []).some((m) => m && m.stageKey === s.key && m.done === false);
        if ((s.key === 'prep' || s.key === 'repair') && !s.done && !cancelledByHuman) { s.done = true; s.doneVia = 'inferred'; s.inferred = true; s.markable = false; s.mark = null; }
      }
    }
  }
  // הזמנה שהוחזרה במלואה / שבוטלה: אין עוד "מה הלאה" - שלבים קודמים שלא סומנו (למשל "הכנה") לא נשארים "נוכחיים" ולא מציעים סימון
  const returnedStage = out.find((s) => (s.key === 'manret' || s.key === 'dback') && s.done);
  const closed = !!closeWhenReturned && (!!order.isDeleted || !!returnedStage || (items.length > 0 && items.every(itemReturned)));
  if (closed) {
    for (const s of out) {
      s.current = false;
      if (!s.done && !s.infoOnly) { s.markable = false; s.closedByReturn = true; }
    }
    return { stages: out, currentKey: null, closed: true, closedBy: order.isDeleted && !returnedStage ? 'cancelled' : 'return' };
  }
  const cur = out.find((s) => !s.done && !s.infoOnly);
  for (const s of out) s.current = !!cur && s === cur;
  return { stages: out, currentKey: cur ? cur.key : null, closed: false, closedBy: null };
}
