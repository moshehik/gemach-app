// lib/history/orderJournal.js — "יומן הזמנה" (A20, כרטיס ההזמנה החדש): לכל שלב של ההזמנה (lib/schedule/orderStages.js) +
// צומת "תשלום" - מתי בוצע, מי ביצע, ומי היה במשמרת באותו רגע. פונקציה טהורה: הקלט נקרא ב-GET /api/orders/[id]/journal.
// בלי prisma, בלי fetch, בלי תאריך לועזי בפלט (רק מפתחות יום 'YYYY-MM-DD' לחישוב בצד הלקוח + תוויות עבריות).
//
// מקורות "בוצע / מי / מתי" (PLAN §C.4), לפי סדר עדיפות:
//   הזמנה             Order.orderDate + Order.employeeId (אין Order.createdAt); שורת CREATE של ההזמנה אם קיימת (רגע מדויק)
//   תיקונים           סימון בלו״ז (repair) -> שורת ALTERATION_DONE האחרונה (או UPDATE alterationDone→true) של פריטי ההזמנה
//   הכנה              סימון בלו״ז (prep)
//   משלוח הלוך/איסוף  סימון (dout/pick) -> שורת CONFIRM_RENTAL הראשונה -> takenDate המוקדם (בלי "מי")
//   אירוע             מידע בלבד
//   החזרה/משלוח חזור  סימון (manret/dback) -> שורת RETURN_RENTAL האחרונה -> returnDate המאוחר (בלי "מי")
//   תשלום             התשלום האחרון (לא מבוטל, לא החזר): paymentDate + מבצע שורת ה-CREATE שלו; "שולם ₪N" = נטו
// משמרת (AMB-18 - אין "שם משמרת" במודל): משמרות שאינן מחוקות שבהן entryTime ≤ T ו-(exitTime ≥ T, או exitTime ריק
// ו-T באותו יום ישראלי כמו הכניסה). כותרת "משמרת · HH:MM–HH:MM" (הכניסה המוקדמת – היציאה המאוחרת; משמרת פתוחה = "עכשיו"
// כשהיום הוא היום, אחרת בלי שעת סיום) + שמות העובדים. רגע בלי שעה (ייבוא ישן, תאריך בלבד) - בלי משמרת.
// שמות משמרות (AMB-18 (B), החלטת הבעלים 2026-10-04): הגדרת הגמ"ח `shift_definitions` = מערך JSON [{name, from, to}] (שעות HH:MM בשעון
// ישראל; טווח שחוצה חצות = from > to, למשל 22:00-06:00). שם המשמרת נקבע לפי שעת הרישום ביומן (לא לפי העובדים): ההגדרה הראשונה
// שהשעה נופלת בה (from <= שעה < to). כותרת: "משמרת בוקר · 08:00–16:00" (שעות ההגדרה) ומתחתיה שמות העובדים שהיו במשמרת. אין הגדרות / השעה
// לא באף הגדרה = אין מידע משמרת בכלל (D3, בעלים 2026-10-05: בלי הגדרות לא מופיעות משמרות - לא כותרת "משמרת · HH:MM–HH:MM", לא טולטיפ ולא שמות). אין עורך בהגדרות עדיין (ייבנה במסך ההגדרות).

import { dayKeyOf, dayLabels } from '../schedule/orderStages.js';

const IL_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const timeOf = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : IL_TIME.format(x);
};
const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
// ייבוא Access: תאריך בלבד (חצות UTC / חצות ישראל) - אין בו שעה אמיתית (כמו looksDateOnly ב-orderHistory.js)
export function looksDateOnly(v) {
  const d = toDate(v);
  if (!d) return false;
  const h = d.getUTCHours();
  return d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && (h === 0 || h === 21 || h === 22);
}
const parse = (s) => {
  if (s && typeof s === 'object') return s;
  try { const v = JSON.parse(s || ''); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};
const money = (n) => `₪${Math.abs(Math.round(Number(n) * 100) / 100).toLocaleString('he-IL')}`;

function whenOf(instant) {
  const d = toDate(instant);
  if (!d) return null;
  const dateOnly = looksDateOnly(d);
  const key = dayKeyOf(d);
  return { ts: d.toISOString(), dayKey: key, day: dayLabels(key), time: dateOnly ? null : timeOf(d), dateOnly };
}

// "24:00" מותר כסוף טווח (חצות) - נשמר כמות שהוא בכותרת, ומשמש 1440 דקות בחישוב
const HHMM_RE = /^([01]?\d|2[0-3]|24):([0-5]\d)$/;
const minutesOf = (hhmm) => { const m = HHMM_RE.exec(hhmm); if (!m) return null; const n = Number(m[1]) * 60 + Number(m[2]); return n > 1440 ? null : n; };
const padHHMM = (hhmm) => { const m = HHMM_RE.exec(hhmm); return `${m[1].padStart(2, '0')}:${m[2]}`; };
export const MAX_SHIFT_DEFINITIONS = 12;

/**
 * הגדרת המשמרות של הגמ"ח (SystemSetting `shift_definitions`): מחרוזת JSON או מערך → מערך מנוקה [{name, from, to}] (HH:MM מרופד).
 * פריט לא תקין (בלי שם, שעה לא תקינה, from == to) מדולג; בלי מערך תקין = []. עד MAX_SHIFT_DEFINITIONS.
 */
export function parseShiftDefinitions(raw) {
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const d of v) {
    if (!d || typeof d !== 'object') continue;
    const name = typeof d.name === 'string' ? d.name.trim().slice(0, 40) : '';
    const from = typeof d.from === 'string' ? d.from.trim() : '';
    const to = typeof d.to === 'string' ? d.to.trim() : '';
    const a = minutesOf(from);
    const b = minutesOf(to);
    if (!name || a === null || b === null || a === b || a >= 1440) continue; // from=24:00 לא תקין (to=24:00 כן)
    out.push({ name, from: padHHMM(from), to: padHHMM(to) });
    if (out.length >= MAX_SHIFT_DEFINITIONS) break;
  }
  return out;
}

/** ההגדרה הראשונה ששעת הרישום (שעון ישראל) נופלת בה; טווח שחוצה חצות (from > to) = שעה >= from או < to. */
export function shiftDefinitionAt(definitions, instant) {
  const t = toDate(instant);
  const defs = Array.isArray(definitions) ? definitions : [];
  if (!t || !defs.length) return null;
  const now = minutesOf(timeOf(t));
  if (now === null) return null;
  for (const d of defs) {
    const a = minutesOf(d.from);
    const b = minutesOf(d.to);
    if (a === null || b === null || a === b) continue;
    if (a < b ? (now >= a && now < b) : (now >= a || now < b)) return d;
  }
  return null;
}

/**
 * משמרות שחופפות לרגע T.
 * @param {Array<{employeeId, name, entryTime, exitTime, isDeleted?}>} shifts
 * @param {*} instant
 * @param {{todayKey?: string, definitions?: Array<{name,from,to}>}} [opts]  definitions = parseShiftDefinitions(...)
 * @returns {{title:string, from:string, to:string|null, open:boolean, names:string[], name?:string}|null}
 */
export function shiftAt(shifts, instant, { todayKey, definitions } = {}) {
  const t = toDate(instant);
  if (!t || looksDateOnly(t)) return null;
  // D3 (בעלים 2026-10-05): "כל עוד לא הגדרתי - לא יופיעו משמרות בכלל" - בלי הגדרות (או שעה שלא באף הגדרה) אין מידע משמרת כלל
  const def = shiftDefinitionAt(definitions, t);
  if (!def) return null;
  const tKey = dayKeyOf(t);
  const hits = (shifts || []).filter((s) => {
    if (!s || s.isDeleted) return false;
    const a = toDate(s.entryTime);
    if (!a || a.getTime() > t.getTime()) return false;
    const b = toDate(s.exitTime);
    if (b) return b.getTime() >= t.getTime();
    return dayKeyOf(a) === tKey; // משמרת פתוחה - רק באותו יום ישראלי
  });
  if (!hits.length) return null;
  const from = new Date(Math.min(...hits.map((s) => toDate(s.entryTime).getTime())));
  const open = hits.some((s) => !toDate(s.exitTime));
  const lastExit = hits.map((s) => toDate(s.exitTime)).filter(Boolean).sort((a, b) => b - a)[0] || null;
  const to = open ? (tKey === todayKey ? 'עכשיו' : null) : timeOf(lastExit);
  const names = [...new Set(hits.map((s) => s.name).filter(Boolean))];
  return { title: `משמרת ${def.name} · ${def.from}–${def.to}`, name: def.name, from: timeOf(from), to, open, names };
}

const isItemRow = (r) => r && r.entityType === 'OrderItem';
const actorOf = (r) => (r ? (r.employeeName || (r.employeeId ? 'עובד שנמחק' : null)) : null);

/**
 * @param {object} input
 * @param {object} input.order        { orderId, orderDate, employeeName? }
 * @param {Array}  input.stages       computeOrderStages(...).stages
 * @param {Array}  [input.auditRows]  named audit rows (attachEmployeeNames): {entityType, entityId, action, changesJson, createdAt, employeeId, employeeName}
 * @param {Array}  [input.items]      {id, isDeleted, takenDate, returnDate}
 * @param {Array}  [input.payments]   {id, amount, paymentDate, isDeleted, isRefund}
 * @param {Map|object} [input.markNames] employeeId -> name (מסמנות בלו״ז)
 * @param {Array}  [input.shifts]     {employeeId, name, entryTime, exitTime, isDeleted}
 * @param {Array}  [input.shiftDefinitions] parseShiftDefinitions(SystemSetting shift_definitions) - שמות משמרות לפי שעה (AMB-18 (B))
 * @param {string} input.todayKey
 * @returns {{nodes: Array<object>, currentKey: string|null}}  nodes מהישן לחדש (הלקוח מציג הפוך - החדש למעלה)
 */
export function buildOrderJournal(input) {
  const { order = {}, stages = [], auditRows = [], items = [], payments = [], shifts = [], todayKey = null, shiftDefinitions = [] } = input || {};
  const names = input && input.markNames instanceof Map ? input.markNames : new Map(Object.entries((input && input.markNames) || {}));
  const rows = [...auditRows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const activeItemIds = new Set(items.filter((i) => !i.isDeleted).map((i) => String(i.id)));
  const onActiveItem = (r) => isItemRow(r) && (!activeItemIds.size || activeItemIds.has(String(r.entityId)));
  const firstRow = (pred) => rows.find(pred) || null;
  const lastRow = (pred) => { for (let i = rows.length - 1; i >= 0; i--) if (pred(rows[i])) return rows[i]; return null; };

  const nodeFrom = (st, src) => {
    const node = {
      key: st.key, label: st.label, icon: st.icon, infoOnly: !!st.infoOnly, done: !!st.done, current: !!st.current,
      plannedDay: st.day || null, when: null, who: null, via: null, shift: null, outcome: st.outcome || null,
    };
    if (src) {
      node.when = whenOf(src.at);
      node.who = src.who || null;
      node.via = src.via;
      node.shift = node.when ? shiftAt(shifts, src.at, { todayKey, definitions: shiftDefinitions }) : null;
    }
    return node;
  };

  const out = [];
  for (const st of stages) {
    let src = null;
    if (st.key === 'order') {
      const create = firstRow((r) => r.entityType === 'Order' && r.action === 'CREATE');
      if (create) src = { at: create.createdAt, who: actorOf(create) || order.employeeName || null, via: 'audit' };
      else if (order.orderDate) src = { at: order.orderDate, who: order.employeeName || null, via: 'table' };
    } else if (st.done && st.doneVia === 'mark' && st.mark) {
      src = { at: st.mark.markedAt, who: st.mark.markedBy || (st.mark.markedById && names.get(st.mark.markedById)) || null, via: 'mark' };
    } else if (st.done && st.doneVia === 'fact') {
      if (st.key === 'repair') {
        const r = lastRow((x) => onActiveItem(x) && (x.action === 'ALTERATION_DONE' || ((x.action === 'UPDATE') && isTrueTo(parse(x.changesJson).alterationDone))));
        if (r) src = { at: r.createdAt, who: actorOf(r), via: 'audit' };
      } else if (st.key === 'pick' || st.key === 'dout') {
        const r = firstRow((x) => onActiveItem(x) && x.action === 'CONFIRM_RENTAL');
        if (r) src = { at: r.createdAt, who: actorOf(r), via: 'audit' };
        else {
          const t = items.filter((i) => !i.isDeleted && i.takenDate).map((i) => toDate(i.takenDate)).filter(Boolean).sort((a, b) => a - b)[0];
          if (t) src = { at: t, who: null, via: 'table' };
        }
      } else if (st.key === 'manret' || st.key === 'dback') {
        const r = lastRow((x) => onActiveItem(x) && x.action === 'RETURN_RENTAL');
        if (r) src = { at: r.createdAt, who: actorOf(r), via: 'audit' };
        else {
          const t = items.filter((i) => !i.isDeleted && i.returnDate).map((i) => toDate(i.returnDate)).filter(Boolean).sort((a, b) => b - a)[0];
          if (t) src = { at: t, who: null, via: 'table' };
        }
      }
    }
    out.push(nodeFrom(st, src));
    if (st.key === 'order') out.push(payNode(payments, rows, shifts, todayKey, shiftDefinitions));
  }
  const cur = out.find((n) => n.current);
  return { nodes: out, currentKey: cur ? cur.key : null };
}

function isTrueTo(v) {
  if (v && typeof v === 'object' && 'to' in v) return v.to === true || v.to === 'true';
  return v === true || v === 'true';
}

function payNode(payments, rows, shifts, todayKey, shiftDefinitions = []) {
  const live = (payments || []).filter((p) => !p.isDeleted);
  const paid = live.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const last = live.filter((p) => !p.isRefund && Number(p.amount) > 0 && p.paymentDate).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0] || null;
  const node = { key: 'pay', label: 'תשלום', icon: 'wallet', infoOnly: false, done: paid > 0, current: false, plannedDay: null, when: null, who: null, via: null, shift: null, outcome: null, paid: Math.round(paid * 100) / 100, paidText: paid > 0 ? `שולם ${money(paid)}` : null };
  if (last) {
    const create = rows.find((r) => r.entityType === 'Payment' && String(r.entityId) === String(last.id) && r.action === 'CREATE');
    const at = create ? create.createdAt : last.paymentDate;
    node.when = whenOf(at);
    node.who = create ? actorOf(create) : null;
    node.via = create ? 'audit' : 'table';
    node.shift = node.when ? shiftAt(shifts, at, { todayKey, definitions: shiftDefinitions }) : null;
  }
  return node;
}
