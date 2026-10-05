// ציר האירוע (OcStepper, הערת הבעלים 2026-10-05: "להחזיר בדיוק בעיצוב של הדגימה"): לוגיקה טהורה (parts/ocStepperLogic.js) על נתוני journal אמיתיים
// (computeOrderStages + buildOrderJournal, 3 אזורי זמן ב-run.mjs) + בדיקות סטטיות (markup / a11y / CSS / שימוש בפלטה בלבד). בלי דפדפן; הצד הוויזואלי נבדק
// ב-scripts/order-card-bg-audit/stepper-cmp.mjs (מול הדגימה).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const S = await P('app/components/order-card/parts/ocStepperLogic.js');
const ST = await P('lib/schedule/orderStages.js');
const J = await P('lib/history/orderJournal.js');
const SET = await P('lib/schedule/settings.js');

const IL = (key, hhmm = '00:00') => { const [h, m] = hhmm.split(':').map(Number); const [y, mo, d] = key.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d, h - 3, m)); };
const MAIN = SET.resolveScheduleSettings({});
const NEVE = SET.resolveScheduleSettings({ enable_deliveries: 'true' });
const ORDER = { orderId: 53375, orderDate: IL('2026-09-23', '10:12'), eventDate: IL('2026-10-08'), isAbroad: false, isDelivery: false, deliveryDirection: null, deliveryCity: null,
  items: [{ id: 'a1', sleeveAlteration: 0 }, { id: 'a2', sleeveAlteration: 0 }] };
const RETURNED = [{ id: 'a1', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-06', '11:00'), isReturned: true, returnDate: IL('2026-10-11', '15:00'), returnedOk: true },
  { id: 'a2', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-06', '11:00'), isReturned: true, returnDate: IL('2026-10-11', '15:00'), returnedOk: true }];

// מה שהנתיב /journal מחזיר (בלי DB): stages (closeWhenReturned) + journal + today + closed/closedBy
function data(order, { schedule = MAIN, todayKey, marks = [], audit = [] } = {}) {
  const r = ST.computeOrderStages(order, { schedule, marks, todayKey, closeWhenReturned: true });
  const j = J.buildOrderJournal({ order: { orderId: order.orderId, orderDate: order.orderDate, employeeName: 'רחל כהן' }, stages: r.stages, auditRows: audit, items: order.items, payments: [], todayKey });
  return { orderId: order.orderId, today: ST.dayLabels(todayKey), stages: r.stages, currentKey: r.currentKey, closed: r.closed, closedBy: r.closedBy, journal: j.nodes };
}
const keys = (m) => m.nodes.map((n) => n.k);
const node = (m, k) => m.nodes.find((n) => n.k === k);

test('הגמ״ח הראשי (איסוף): הזמנה · לקיחה · אירוע · החזרה - כמו renderTimeline; הכנה/תיקונים לא על הציר; כותרות כמו בעיצוב', () => {
  const m = S.buildStepper(data(ORDER, { todayKey: '2026-10-04' }));
  assert.deepEqual(keys(m), ['order', 'pick', 'event', 'manret']);
  assert.deepEqual(m.nodes.map((n) => n.label), ['הזמנה', 'לקיחה', 'אירוע', 'החזרה']);
  assert.deepEqual(m.nodes.map((n) => n.icon), ['file', 'bag', 'gift', 'undo']);
  assert.ok(m.nodes.every((n) => !n.deliv));
});

test('נווה (משלוח הלוך-חזור): הזמנה · משלוח הלוך · אירוע · משלוח חזור; צמתי משלוח deliv עם עיר', () => {
  const o = { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים' };
  const m = S.buildStepper(data(o, { schedule: NEVE, todayKey: '2026-10-04' }), { order: o });
  assert.deepEqual(keys(m), ['order', 'dout', 'event', 'dback']);
  assert.ok(node(m, 'dout').deliv && node(m, 'dback').deliv && !node(m, 'event').deliv);
  assert.equal(node(m, 'dout').city, 'ירושלים');
  assert.equal(node(m, 'event').city, '');
  const onlyOut = { ...o, deliveryDirection: 'הלוך' };
  assert.deepEqual(keys(S.buildStepper(data(onlyOut, { schedule: NEVE, todayKey: '2026-10-04' }), { order: onlyOut })), ['order', 'dout', 'event', 'manret'], 'משלוח הלוך בלבד: החזרה ידנית');
  const noDel = S.buildStepper(data({ ...ORDER, isDelivery: false }, { schedule: NEVE, todayKey: '2026-10-04' }));
  assert.deepEqual(keys(noDel), ['order', 'pick', 'event', 'manret'], 'משלוחים דלוקים אבל ההזמנה לא משלוח: איסוף');
});

test('שלב כבוי בהגדרות הלו״ז לא מופיע; בלי stages / בלי today = null', () => {
  const off = SET.resolveScheduleSettings({ schedule_stage_pick_enabled: 'false' });
  const r = ST.computeOrderStages(ORDER, { schedule: { ...MAIN, stages: { ...MAIN.stages, pick: { ...MAIN.stages.pick, enabled: false } } }, todayKey: '2026-10-04' });
  assert.ok(!r.stages.some((s) => s.key === 'pick'));
  assert.ok(off);
  assert.equal(S.buildStepper(null), null);
  assert.equal(S.buildStepper({ stages: [], today: ST.dayLabels('2026-10-04') }), null);
  assert.equal(S.buildStepper({ stages: [{ key: 'prep', dayKey: '2026-10-05' }], today: ST.dayLabels('2026-10-04') }), null, 'רק הכנה = אין צמתי ציר');
});

test('סמן "היום" בין הצומת האחרון שבוצע לבא: between / --f מוגבל 0.2..0.8 / fill כמו בעיצוב', () => {
  // היום 4.10: הזמנה בוצעה (23.9), לקיחה 6.10 עוד לא -> היום בין הזמנה ללקיחה
  const m = S.buildStepper(data(ORDER, { todayKey: '2026-10-04' }));
  assert.equal(m.idx, 1);
  assert.equal(node(m, 'order').between, true);
  assert.equal(node(m, 'order').done, true);
  assert.equal(node(m, 'pick').cur, false);
  assert.equal(node(m, 'pick').status, 'fut');
  assert.ok(node(m, 'order').f >= 0.2 && node(m, 'order').f <= 0.8);
  assert.equal(node(m, 'order').fill, node(m, 'order').f, 'fill = החלק שעבר מהקו');
  // 11 מתוך 13 ימים -> 0.846 -> מוגבל ל-0.8
  assert.equal(node(m, 'order').f, 0.8);
  // היום בדיוק יום הלקיחה -> הצומת נוכחי (סמן בתוך העיגול), בלי between, הקו מלא
  const t = S.buildStepper(data(ORDER, { todayKey: '2026-10-06' }));
  assert.equal(node(t, 'pick').cur, true);
  assert.equal(node(t, 'pick').status, 'cur');
  assert.equal(node(t, 'order').between, false);
  assert.equal(node(t, 'order').fill, 1);
  assert.equal(node(t, 'pick').fill, 0);
});

test('צומת שחלף מועדו ולא בוצע = נוכחי (ממתין), לא "בוצע"; אירוע שחלף = בוצע', () => {
  const m = S.buildStepper(data(ORDER, { todayKey: '2026-10-09' })); // אחרי האירוע (8.10), בלי לקיחה
  assert.equal(node(m, 'pick').done, false);
  assert.equal(node(m, 'pick').cur, true, 'ממתין');
  assert.equal(node(m, 'event').done, true);
  assert.match(m.nowRows[1].text, /ממתין · לקיחה/);
});

test('הזמנה שהוחזרה (צילום הבעלים): כל הצמתים בוצעו, אין צומת נוכחי ואין סמן היום; החזרה חלקית לא סוגרת', () => {
  const o = { ...ORDER, items: RETURNED };
  const audit = [{ entityType: 'OrderItem', entityId: 'a1', action: 'RETURN_RENTAL', createdAt: IL('2026-10-11', '15:00'), employeeName: 'דוד לוי' }];
  const m = S.buildStepper(data(o, { todayKey: '2026-10-11', audit }), { order: o, items: o.items });
  assert.equal(m.closed, true);
  assert.equal(m.closedBy, 'return');
  assert.equal(m.idx, -1);
  assert.ok(m.nodes.every((n) => n.done && !n.cur && !n.between && n.status === 'done'));
  assert.ok(m.nodes.slice(0, -1).every((n) => n.fill === 1), 'כל הקווים מלאים');
  const ret = node(m, 'manret');
  assert.ok(ret.rows.some((r) => r.text === 'התקבלו ע״י דוד לוי'));
  assert.ok(ret.rows.some((r) => r.text === 'חזרו תקינים'));
  assert.equal(m.nowRows.length, 1, 'אין שורת "השלב הבא"');
  const partial = { ...ORDER, items: [RETURNED[0], { id: 'a2', sleeveAlteration: 0, isTaken: true }] };
  const p = S.buildStepper(data(partial, { todayKey: '2026-10-11' }));
  assert.equal(p.closed, false);
  assert.equal(node(p, 'manret').done, false);
  assert.equal(p.idx, p.nodes.findIndex((n) => n.k === 'manret'), 'החזרה חלקית: ההחזרה היא הצומת הממתין');
});

test('הזמנה מבוטלת: רק "הזמנה" בוצעה, בלי צומת נוכחי ובלי סמן היום', () => {
  const m = S.buildStepper(data({ ...ORDER, isDeleted: true }, { todayKey: '2026-10-04' }));
  assert.equal(m.closedBy, 'cancelled');
  assert.deepEqual(m.nodes.map((n) => n.done), [true, false, false, false]);
  assert.ok(m.nodes.every((n) => !n.cur && !n.between));
  assert.equal(m.idx, -1);
});

test('חו״ל / תקופה ארוכה: צומת האירוע מציג טווח (heShort - endHeShort); ההחזרה לפי toDate', () => {
  const o = { ...ORDER, isAbroad: true, fromDate: IL('2026-10-06'), toDate: IL('2026-10-14'), eventDate: IL('2026-10-06') };
  const m = S.buildStepper(data(o, { todayKey: '2026-10-04' }));
  const ev = node(m, 'event');
  assert.ok(ev.endHeShort, 'יש תאריך סיום');
  assert.ok(ev.rows.some((r) => r.icon === 'cal' && r.text.startsWith('עד ')));
  assert.equal(node(m, 'manret').dayKey, '2026-10-14');
});

test('כרטיסים עשירים: עובדות בלבד - תאריך עברי מלא; מי/מתי כשקיים; בלי שעות / מקום / איחור / קשר בדויים', () => {
  const o = { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: 'עמוס 14', eventType: 'חתונה' };
  const audit = [{ entityType: 'Order', entityId: 'x', action: 'CREATE', createdAt: IL('2026-09-23', '10:12'), employeeName: 'רחל כהן' }];
  const m = S.buildStepper(data(o, { schedule: NEVE, todayKey: '2026-10-04', audit }), { order: o, items: o.items, courier: 'יוסי מזרחי' });
  const all = (n) => n.rows.map((r) => r.text);
  assert.match(all(node(m, 'order'))[0], /^יום [^,]+, .+ תשפ"ו$|^יום [^,]+, .+ תשפ"ז$/, 'תאריך עברי מלא');
  assert.ok(all(node(m, 'order')).includes('רחל כהן · 10:12'));
  const dout = all(node(m, 'dout'));
  assert.ok(dout.includes('ירושלים') && dout.includes('עמוס 14') && dout.includes('יוסי מזרחי') && dout.includes('טרם יצא'));
  assert.ok(all(node(m, 'event')).includes('חתונה'));
  const text = m.nodes.flatMap(all).join('|');
  assert.ok(!/\d{1,2}:\d{2}–\d{1,2}:\d{2}|₪|איחור|050-|אולמי|סניף/.test(text), 'אין פרטים בדויים של הדגימה');
  // בלי ספק שליח / בלי עיר: השורות לא מופיעות
  const bare = S.buildStepper(data({ ...o, deliveryCity: null, deliveryAddress: null }, { schedule: NEVE, todayKey: '2026-10-04' }), { order: { ...o, deliveryCity: null, deliveryAddress: null } });
  assert.deepEqual(all(node(bare, 'dout')).filter((x) => /ירושלים|עמוס|יוסי/.test(x)), []);
  assert.equal(all(node(bare, 'order')).length, 2, 'הזמנה: התאריך + מי/מתי מהטבלה (orderDate + עובד)');
});

test('צומת "היום": שורות = תאריך עברי + כמה ימים לשלב הבא; בלי משמרות - אין מידע משמרת בציר', () => {
  const m = S.buildStepper(data(ORDER, { todayKey: '2026-10-04' }));
  assert.equal(m.nowRows[0].icon, 'cal');
  assert.match(m.nowRows[1].text, /^בעוד 2 ימים · לקיחה$/);
  assert.equal(S.daysBetween('2026-10-04', '2026-10-05'), 1);
  assert.equal(S.daysBetween('2026-10-05', '2026-10-04'), -1);
  assert.equal(S.daysBetween(null, '2026-10-04'), null);
  assert.ok(!JSON.stringify(m.nodes.map((n) => n.rows)).includes('משמרת'));
  const one = S.buildStepper(data(ORDER, { todayKey: '2026-10-05' }));
  assert.equal(one.nowRows[1].text, 'בעוד 1 יום · לקיחה');
});

// ---------- סטטי ----------
test('OcStepper: markup של renderTimeline (stepper > tlx > tx > dot / tt / today), a11y, כרטיס עשיר ב-portal; מחובר לכרטיס במקום ה-div הריק', () => {
  const c = strip(read('app/components/order-card/OcStepper.js'));
  assert.match(c, /<div className="stepper" id="stepper">/);
  assert.match(c, /<div className="tlx" style=\{\{ '--n': model\.nodes\.length \}\} role="list" aria-label="ציר ההזמנה">/);
  assert.match(c, /role="listitem"/);
  assert.match(c, /className=\{`tx \$\{n\.status\}\$\{n\.between \? ' hasnow' : ''\}\$\{n\.done && fresh\.has\(n\.k\) \? ' fresh' : ''\}\$\{n\.deliv \? ' deliv' : ''\}`\}/);
  assert.match(c, /style=\{\{ '--fill': n\.fill\.toFixed\(3\) \}\}/);
  assert.match(c, /data-rich=\{`tl\|\$\{n\.k\}`\}/);
  assert.match(c, /tabIndex=\{0\}/);
  assert.match(c, /aria-current=\{n\.cur \? 'step' : undefined\}/);
  assert.match(c, /<div className="dot">/);
  assert.match(c, /<span className="ck"><OcIcon name="check" \/><\/span>/);
  assert.match(c, /<div className="tt">/);
  assert.match(c, /<div className="today" style=\{\{ '--f': n\.f\.toFixed\(2\) \}\}>/);
  assert.match(c, /className="tip pinm" aria-label="היום"/);
  assert.match(c, /role="tooltip"/);
  assert.match(c, /aria-describedby=\{rich && rich\.key === n\.k \? descId : undefined\}/);
  for (const ev of ['onMouseEnter', 'onMouseLeave', 'onFocus', 'onBlur', 'onClick']) assert.ok(c.includes(ev), ev);
  assert.match(c, /e\.key === 'Escape'/);
  assert.match(c, /matchMedia\('\(hover:none\)'\)/, 'מגע: הקשה פותחת/סוגרת');
  assert.match(c, /document\.querySelector\('\[data-sticky-nav\]'\)/, 'לא נבלע מתחת לתפריט העליון');
  assert.ok(!/title=/.test(c) && !/window\.(alert|confirm)/.test(c));
  const a5 = strip(read('app/components/order-card/OrderCardA5.js'));
  assert.match(a5, /<OcStepper oc={oc} data={journalData} />/);
  assert.ok(!/<div className="stepper" id="stepper" aria-hidden="true" \/>/.test(a5), 'ה-div הריק הוסר');
});

test('CSS: אין הסתרת #stepper; ה-CSS של הציר רק בפלטה (אין צבעים/hex חדשים לציר בקבצי הכרטיס); דליפת display:flex של האתר מנוטרלת', () => {
  const base = read('app/components/order-card/css/oc-base.css');
  assert.ok(!/#stepper\{display:none/.test(strip(base)));
  assert.match(base, /\.gm-ds\.gm-oc \.stepper\{display:block;align-items:normal;margin-bottom:0\}/);
  const ds = read('design-system/components.css');
  for (const sel of ['.gm-ds .tlx{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr))}', '.gm-ds .tx .dot{', '.gm-ds .tx .ck{', '.gm-ds .tx .today{', '.gm-ds .tip.pinm{', '.gm-ds .pl-rt{']) assert.ok(ds.includes(sel), `הפלטה מכילה ${sel}`);
  assert.ok(!/\.tlx|\.tx\b/.test(strip(base + read('app/components/order-card/css/oc-history.css') + read('app/components/order-card/css/oc-details.css'))), 'אין כללי ציר מקומיים (רק הפלטה)');
  assert.match(read('app/api/orders/[id]/journal/route.js'), /closedBy: closedBy \|\| null/);
});

test('לשונית ההיסטוריה (יומן הזמנה) לא השתנתה: עדיין OcJournalCard + פיד; הציר אינו חלק ממנה', () => {
  const h = strip(read('app/components/order-card/tabs/OcHistoryTab.js'));
  assert.match(h, /<OcJournalCard /);
  assert.ok(!/OcStepper/.test(h));
});
