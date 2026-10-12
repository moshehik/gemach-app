// בדיקת רינדור (SSR) של מסך "המרות בעמדה" ורכיבי הגרפים: מרכיבים את ה-HTML האמיתי של המסך מנתונים סינתטיים (בלי שרת dev, בלי דפדפן; JSX מקומפל ב-SWC של Next)
// ובודקים שאין שגיאת רינדור, אין NaN / undefined / Infinity, כל הטקסטים בעברית, הגרפים מכילים את המספרים הנכונים, ומצבי הקצה (ריק / כבוי / טבלה חסרה) מוצגים.
// זו לא בדיקה ויזואלית: מידות, חפיפות ו-RTL בפועל (getBoundingClientRect) נבדקים רק בדפדפן.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const req = createRequire(path.join(PROJ, 'package.json'));
const React = req('react');
const { renderToString, renderToStaticMarkup } = req('react-dom/server');
const h = React.createElement;

const Page = (await L('app/components/station-analytics/StationAnalyticsPage.js')).default;
const Charts = await L('app/components/station-analytics/StationCharts.js');
const C = await L('lib/stationAnalytics/compute.js');
const { getIsraelTodayKey, addDaysToDateKey } = await L('lib/hebrewDate.js');

const today = getIsraelTodayKey();
const NOW = new Date();
function sample({ withData = true, channel = 'public', linkEnabled = true } = {}) {
  const from = addDaysToDateKey(today, -6);
  const day = (i) => addDaysToDateKey(from, i);
  const customers = new Map();
  const registrations = [];
  const orders = [];
  const events = [];
  if (withData) {
    for (let i = 0; i < 7; i++) {
      events.push({ dayKey: day(i), type: 'visit', channel: 'public', count: 20 + i * 5 });
      events.push({ dayKey: day(i), type: 'availability', channel: 'public', count: 8 + i });
      events.push({ dayKey: day(i), type: 'form_start', channel: 'public', count: 4 + (i % 3) });
      for (let k = 0; k < 2 + (i % 3); k++) {
        const id = `c${i}-${k}`;
        const at = new Date(Date.parse(`${day(i)}T09:00:00Z`) + k * 60000);
        customers.set(id, { isDeleted: false, state: k === 0 ? 'verified' : 'pending' });
        registrations.push({ customerId: id, dayKey: day(i), at, channel: 'public', outcome: 'created' });
        if (k === 0) orders.push({ customerId: id, orderDate: new Date(at.getTime() + 3600000), confirmed: true, hasItem: true });
      }
    }
  }
  const input = { from, to: today, channel, windowDays: 14, now: NOW, events, registrations, customers, orders };
  const result = C.buildAnalytics(input);
  const ref = C.buildAnalytics({ ...input, from: addDaysToDateKey(today, -7), to: today });
  const cards = C.buildCards({ daily: ref.daily, todayKey: today, topMeasured: result.topMeasured });
  return { status: 'ok', generatedAt: NOW.toISOString(), ...result, cards, linkEnabled, storeSelfService: false };
}
const LIST = {
  status: 'ok',
  rows: [
    { customerId: 'a', name: 'שרה כ.', at: NOW.toISOString(), channel: 'public', outcome: 'created', verification: 'verified', closedSameDay: true, closed: true, savedUnpaid: false },
    { customerId: 'b', name: 'רחל ל.', at: NOW.toISOString(), channel: 'kiosk', outcome: 'existing-marked', verification: 'repeat', closedSameDay: false, closed: false, savedUnpaid: true },
    { customerId: 'c', name: 'לאה מ.', at: NOW.toISOString(), channel: 'public', outcome: 'created', verification: 'pending', closedSameDay: false, closed: false, savedUnpaid: false },
  ],
};
const render = (preload) => renderToString(h(Page, { preload }));
const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('full screen with data: renders, no NaN / undefined / Infinity / [object Object], RTL root, all four sections', () => {
  const html = render({ data: sample(), list: LIST });
  assert.ok(html.length > 5000);
  assert.ok(!/NaN|undefined|Infinity|\[object Object\]/.test(html), 'טקסט שבור בפלט');
  assert.ok(html.includes('dir="rtl"'));
  for (const id of ['sa-sum', 'sa-funnel', 'sa-daily', 'sa-regs']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('המרות בעמדה הציבורית'));
  assert.equal((html.match(/class="card sa-tile/g) || []).length, 5);
});

test('visible text is Hebrew only (no English words) and shows no Gregorian date', () => {
  const html = render({ data: sample(), list: LIST });
  const text = textOf(html);
  const words = text.match(/[A-Za-z]{3,}/g) || [];
  assert.deepEqual(words, []);
  assert.ok(!/\b(19|20)\d{2}-\d{2}-\d{2}\b/.test(text), 'תאריך ISO גלוי');
  assert.ok(!/\b\d{1,2}[./]\d{1,2}[./](19|20)?\d{2}\b/.test(text), 'תאריך לועזי גלוי');
});

test('funnel bars carry the real totals and conversion rates', () => {
  const data = sample();
  const html = render({ data, list: LIST });
  const t = textOf(html);
  assert.ok(t.includes(`${data.totals.visits}`));
  assert.ok(t.includes('נכנסו לעמדה') && t.includes('מילאו פרטים') && t.includes('סגרו הזמנה') && t.includes('אומתו על ידי עובדת'));
  assert.ok(/מתוך מי שפתחו את הטופס/.test(t));
  const bars = [...html.matchAll(/class="sa-fbar" style="width:([\d.]+)%"/g)].map((m) => parseFloat(m[1]));
  assert.equal(bars.length, 6);
  assert.equal(bars[0], 100); // הגדול ביותר = נכנסו
  assert.ok(bars.every((b) => b >= 0 && b <= 100));
  assert.ok(bars[3] > 0 && bars[3] < bars[0]);
});

test('summary tiles: today / yesterday / weekly average with comparison arrows', () => {
  const html = render({ data: sample(), list: LIST });
  assert.ok(html.includes('אתמול') && html.includes('ממוצע שבועי'));
  assert.ok(/sa-delta sa-(up|down|same)/.test(html));
});

test('daily columns chart: one hit band per day, 7 bands, RTL order (first day at the right edge), tooltips accessible via aria-label', () => {
  const data = sample();
  const days = data.daily.map((r) => ({ day: r.day, label: r.day.slice(5), title: `יום ${r.day}` }));
  const html = renderToStaticMarkup(h(Charts.DayColumns, { days, ariaLabel: 'בדיקה', emptyText: 'ריק', series: [{ key: 'a', label: 'מילאו פרטים', slot: 2, values: data.daily.map((r) => r.registered) }, { key: 'b', label: 'סגרו הזמנה', slot: 1, values: data.daily.map((r) => r.closedInWindow) }] }));
  const hits = [...html.matchAll(/<rect class="sa-hit" x="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
  assert.equal(hits.length, 7);
  assert.ok(hits[0] > hits[6], 'היום הראשון אמור להיות בימין (x גדול)');
  assert.ok((html.match(/aria-label="יום [^"]*מילאו פרטים \d+, סגרו הזמנה \d+"/g) || []).length === 7);
  assert.ok(html.includes('sa-legend'));
  assert.ok(!/NaN|Infinity/.test(html));
  assert.ok(!html.includes('sa-empty-over'));
});

test('daily columns chart with all zeros: shows the empty message, not a flat chart; single series has no legend', () => {
  const days = [{ day: '2026-10-11', label: 'א', title: 'א' }, { day: '2026-10-12', label: 'ב', title: 'ב' }];
  const html = renderToStaticMarkup(h(Charts.DayColumns, { days, ariaLabel: 'x', emptyText: 'אין כניסות בטווח הזה', series: [{ key: 'v', label: 'נכנסו', slot: 1, values: [0, 0] }] }));
  assert.ok(html.includes('אין כניסות בטווח הזה'));
  assert.ok(!html.includes('sa-legend'));
  assert.ok(!/NaN|Infinity/.test(html));
  const one = renderToStaticMarkup(h(Charts.DayColumns, { days: [{ day: '2026-10-12', label: 'ב', title: 'ב' }], ariaLabel: 'x', emptyText: 'e', series: [{ key: 'v', label: 'נכנסו', slot: 1, values: [5] }] }));
  assert.ok(/<path class="sa-col sa-f1"/.test(one));
});

test('rate line: gaps for days without visits (null) break the line; nothing to draw -> empty message', () => {
  const days = Array.from({ length: 5 }, (_, i) => ({ day: `2026-10-0${i + 1}`, label: `${i}`, title: `י${i}` }));
  const html = renderToStaticMarkup(h(Charts.RateLine, { days, label: 'אחוז', ariaLabel: 'x', emptyText: 'אין עדיין מספיק נתונים', values: [0.1, 0.2, null, 0.3, 0.25] }));
  assert.equal((html.match(/<polyline/g) || []).length, 2); // קטע לפני הרווח וקטע אחריו
  assert.equal((html.match(/<circle/g) || []).length, 4);
  const empty = renderToStaticMarkup(h(Charts.RateLine, { days, label: 'אחוז', ariaLabel: 'x', emptyText: 'אין עדיין מספיק נתונים', values: [null, null, null, null, null] }));
  assert.ok(empty.includes('אין עדיין מספיק נתונים'));
  assert.ok(!/NaN/.test(html + empty));
});

test('channel kiosk: top-of-funnel tiles are shown as not measured with an explanation, funnel rows say so', () => {
  const html = render({ data: sample({ channel: 'kiosk' }), list: LIST });
  assert.ok(html.includes('נמדד רק בקישור הכללי'));
  assert.ok(html.includes('לא נמדד בערוץ הזה'));
  assert.ok(!/NaN|undefined/.test(html));
});

test('empty data (link on, nothing collected yet): zeros / dashes, explanatory text, no broken charts', () => {
  const html = render({ data: sample({ withData: false }), list: { status: 'ok', rows: [] } });
  assert.ok(html.includes('עדיין אין נתונים בטווח הזה'));
  assert.ok(html.includes('אין רישומים ביום הזה'));
  assert.ok(!/NaN|undefined|Infinity/.test(html));
});

test('link disabled with no data: explanation card instead of misleading empty metrics; with data: banner + historical numbers', () => {
  const off = render({ data: sample({ withData: false, linkEnabled: false }), list: { status: 'ok', rows: [] } });
  const t = textOf(off);
  assert.ok(t.includes('הקישור הציבורי כבוי בארגון הזה'));
  assert.ok(t.includes('אין מדדים להציג'));
  assert.ok(!off.includes('id="sa-funnel"'));
  const hist = render({ data: sample({ withData: true, linkEnabled: false }), list: LIST });
  assert.ok(textOf(hist).includes('הקישור הציבורי כבוי בארגון הזה'));
  assert.ok(hist.includes('id="sa-funnel"'));
});

test('events table missing: explains that collection is not enabled yet; no charts', () => {
  const html = render({ data: { status: 'no_table', linkEnabled: true }, list: { status: 'no_table', rows: [] } });
  assert.ok(textOf(html).includes('איסוף הנתונים עדיין לא הופעל בארגון הזה'));
  assert.ok(!html.includes('id="sa-funnel"'));
});

test('registrations table: shortened names only, verification + order chips, channel and repeat marks; forbidden state hides the list', () => {
  const html = render({ data: sample(), list: LIST });
  const t = textOf(html);
  for (const n of ['שרה כ.', 'רחל ל.', 'לאה מ.']) assert.ok(t.includes(n), n);
  assert.ok(t.includes('אומתה') && t.includes('ממתינה לאימות') && t.includes('סגרה היום') && t.includes('שמרה בלי שולם') && t.includes('עדיין לא') && t.includes('רישום חוזר'));
  assert.ok(t.includes('עמדת חנות') && t.includes('קישור כללי'));
  const forb = render({ data: sample(), list: { status: 'forbidden', rows: [] } });
  assert.ok(textOf(forb).includes('מורשה לצפות בפרטי לקוחות'));
  assert.ok(!/<table[^>]*data-agy-id="sa_regs_table"/.test(forb));
});

test('accessibility basics: radiogroups labelled, charts have table alternative toggles, buttons have names', () => {
  const html = render({ data: sample(), list: LIST });
  assert.ok((html.match(/role="radiogroup"/g) || []).length >= 4);
  assert.ok(html.includes('aria-label="תקופה"') && html.includes('aria-label="ערוץ"'));
  assert.ok(html.includes('aria-label="תצוגת המשפך"') && html.includes('aria-label="תצוגת הגרפים"'));
  const emptyButtons = [...html.matchAll(/<button\b[^>]*>(\s*)<\/button>/g)];
  assert.equal(emptyButtons.length, 0);
});
