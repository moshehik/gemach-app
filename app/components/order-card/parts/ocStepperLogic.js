// ocStepperLogic — הציר העליון של כרטיס ההזמנה ("ציר האירוע", .stepper > .tlx > .tx) - לוגיקה טהורה, בלי DOM ובלי fetch.
// המקור לצמתים: GET /api/orders/[id]/journal (lib/schedule/orderStages.js + lib/history/orderJournal.js) - אותם שלבים כמו ב"שלבי ההזמנה" של לשונית ההיסטוריה,
// לפי הגדרות מסך הלו״ז, בלי פרטים בדויים (החלטת הבעלים, A5 "נשאר, מסומן; בלי הפרטים הבדויים"): בכרטיסים העשירים רק עובדות שקיימות בנתונים.
//
// הצמתים והעיצוב = renderTimeline() בעיצוב המאושר (תצוגות-עיצוב/כרטיס-הזמנה.html, שורות 3432-3461):
//   הזמנה (file) · משלוח הלוך (truck, deliv) או לקיחה (bag) · אירוע (gift) · משלוח חזור (truck, deliv) או החזרה (undo); כותרות כמו בעיצוב.
//   כל צומת: .tx.done|cur|fut [.hasnow] עם --fill, .dot (אייקון / סמן "היום" בצומת הנוכחי + .ck כשבוצע), .tt (שם, יום · תאריך עברי, עיר במשלוח),
//   ו-.today (סמן "היום") בין הצומת האחרון שבוצע לבא אחריו כשהבא עוד לא הגיע.
//   done/cur/between/fill כמו בעיצוב: idx = הצומת הראשון שלא בוצע; fill של צומת שבוצע = 1 אם הבא אחריו בוצע, אחרת (הצומת שלפני idx) 1 כשהבא הוא היום, אחרת
//   החלק היחסי f (לפי ימים, מוגבל ל-0.2..0.8) - אותו חישוב כמו שורות 3452-3456.
// הבדלים מכוונים מהעיצוב (נתוני אמת): "בוצע" = עובדה במערכת (סימון / פריטים נלקחו-הוחזרו), לא "התאריך עבר"; צומת שחלף מועדו ולא בוצע = "נוכחי" (ממתין); הזמנה
// שהוחזרה במלואה = כל הצמתים בוצעו ואין צומת נוכחי ואין סמן "היום" (closeWhenReturned); הזמנה מבוטלת = רק "הזמנה" בוצעה, בלי צומת נוכחי.

import { shortHebrew, hebrewWithGershayim } from './ocHistoryModel';

export const STEPPER_KEYS = ['order', 'pick', 'dout', 'event', 'manret', 'dback'];
export const STEPPER_UI = {
  order: { label: 'הזמנה', icon: 'file' },
  dout: { label: 'משלוח הלוך', icon: 'truck', deliv: true },
  pick: { label: 'לקיחה', icon: 'bag' },
  event: { label: 'אירוע', icon: 'gift' },
  dback: { label: 'משלוח חזור', icon: 'truck', deliv: true },
  manret: { label: 'החזרה', icon: 'undo' },
};

const dayNum = (key) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
export const daysBetween = (fromKey, toKey) => { const a = dayNum(fromKey); const b = dayNum(toKey); return a === null || b === null ? null : Math.round((b - a) / 864e5); };
const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
const whoWhen = (n) => [n && n.who, n && n.when && n.when.time].filter(Boolean).join(' · ');

/** שורות הכרטיס העשיר של צומת - עובדות בלבד (תאריך עברי מלא; מי/מתי כשקיים; עיר/כתובת/שליחה כשקיימים; סטטוס). [{icon, text}] */
export function stepperRows(key, { stage, node, order = {}, items = [], courier = '' } = {}) {
  const rows = [];
  const day = stage && stage.day;
  if (day && day.he) rows.push({ icon: 'cal', text: `${day.wdFull || ''}${day.wdFull ? ', ' : ''}${hebrewWithGershayim(day.he)}` });
  const done = !!(stage && stage.done);
  const active = (items || []).filter((i) => i && !i.isDeleted);
  const ww = whoWhen(node);
  if (key === 'order') {
    if (ww) rows.push({ icon: 'user', text: ww });
  } else if (key === 'pick') {
    if (active.length) rows.push({ icon: 'dress', text: plural(active.length, 'שמלה אחת', 'שמלות') });
    if (done && node && node.who) rows.push({ icon: 'user', text: `נמסרו ע״י ${node.who}` });
  } else if (key === 'dout' || key === 'dback') {
    const o = key === 'dout';
    if (order.deliveryCity) rows.push({ icon: 'pin', text: order.deliveryCity });
    if (order.deliveryAddress) rows.push({ icon: 'pin', text: order.deliveryAddress });
    if (courier) rows.push({ icon: 'user', text: courier });
    rows.push({ icon: done ? 'check' : 'clock', text: done ? (o ? 'נמסר' : 'נאסף') : (o ? 'טרם יצא' : 'טרם נאסף') });
    if (done && ww) rows.push({ icon: 'user', text: ww });
  } else if (key === 'event') {
    if (stage && stage.endDay && stage.endDay.he) rows.push({ icon: 'cal', text: `עד ${stage.endDay.wdFull ? `${stage.endDay.wdFull}, ` : ''}${hebrewWithGershayim(stage.endDay.he)}` });
    if (order.eventType) rows.push({ icon: 'gift', text: order.eventType });
  } else if (key === 'manret') {
    if (done && node && node.who) rows.push({ icon: 'user', text: `התקבלו ע״י ${node.who}` });
    if (done && ww && !(node && node.who)) rows.push({ icon: 'clock', text: ww });
    if (done && stage.outcome) rows.push({ icon: stage.outcome === 'ok' ? 'check' : 'alert', text: stage.outcome === 'ok' ? 'חזרו תקינים' : 'לא תקין' });
  }
  if (key === 'dback' && done && stage.outcome) rows.push({ icon: stage.outcome === 'ok' ? 'check' : 'alert', text: stage.outcome === 'ok' ? 'חזרו תקינים' : 'לא תקין' });
  return rows;
}

/**
 * @param {{stages:Array,journal:Array,today:object,closed?:boolean,closedBy?:string|null}} data  תשובת GET /api/orders/[id]/journal
 * @param {{order?:object, items?:Array, courier?:string}} ctx  order/items מהבקר (עיר/כתובת/סוג אירוע/ספירת שמלות), courier = delivery courier_name מההגדרות
 * @returns {null|{nodes:Array,idx:number,closed:boolean,closedBy:string|null,todayKey:string,nowRows:Array}} null = אין מה להציג
 */
export function buildStepper(data, { order = {}, items = [], courier = '' } = {}) {
  if (!data || !Array.isArray(data.stages)) return null;
  const todayKey = data.today && data.today.dayKey;
  if (!todayKey) return null;
  const byKey = new Map((data.journal || []).map((n) => [n.key, n]));
  const closedBy = data.closed ? (data.closedBy || 'return') : null;
  const picked = data.stages.filter((s) => STEPPER_KEYS.includes(s.key) && s.dayKey);
  if (!picked.length) return null;
  const nodes = picked.map((s) => {
    const ui = STEPPER_UI[s.key];
    const factDone = s.key === 'order' ? true : !!s.done;
    const done = s.key === 'order' ? true : closedBy === 'return' ? true : closedBy === 'cancelled' ? false : factDone;
    return { k: s.key, label: ui.label, icon: ui.icon, deliv: !!ui.deliv, dayKey: s.dayKey, wd: s.day && s.day.wd, heShort: s.day ? shortHebrew(s.day.heShort || s.day.he) : '', endHeShort: s.endDay ? shortHebrew(s.endDay.heShort || s.endDay.he) : null,
      city: ui.deliv ? (order.deliveryCity || '') : '', done, stage: s, rows: stepperRows(s.key, { stage: s, node: byKey.get(s.key), order, items, courier }) };
  });
  const idx = closedBy ? -1 : nodes.findIndex((n) => !n.done);
  const diff = (a, b) => daysBetween(a, b);
  nodes.forEach((n, i) => {
    n.cur = i === idx && diff(todayKey, n.dayKey) <= 0; // הגיע מועדו (או חלף ולא בוצע)
    n.between = i === idx - 1 && idx > 0 && diff(todayKey, nodes[idx].dayKey) > 0;
    n.status = n.done ? 'done' : n.cur ? 'cur' : 'fut';
    n.f = 0.5;
    if (n.between) {
      const span = Math.max(1, diff(n.dayKey, nodes[idx].dayKey));
      n.f = Math.min(0.8, Math.max(0.2, diff(n.dayKey, todayKey) / span));
    }
    n.fill = 0;
    if (n.done && i + 1 < nodes.length) {
      if (nodes[i + 1].done) n.fill = 1;
      else if (i === idx - 1) n.fill = diff(todayKey, nodes[idx].dayKey) <= 0 ? 1 : n.f;
    }
  });
  const nowRows = [];
  const t = data.today;
  nowRows.push({ icon: 'cal', text: `${t.wdFull ? `${t.wdFull}, ` : ''}${hebrewWithGershayim(t.he)}` });
  if (idx >= 0) {
    const nx = nodes[idx];
    const d = diff(todayKey, nx.dayKey);
    nowRows.push({ icon: 'clock', text: d > 0 ? `בעוד ${d} ${d === 1 ? 'יום' : 'ימים'} · ${nx.label}` : d === 0 ? `היום · ${nx.label}` : `ממתין · ${nx.label}` });
  }
  return { nodes, idx, closed: !!closedBy, closedBy, todayKey, nowRows };
}
