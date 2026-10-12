// בדיקות העזרים הטהורים של גרפי המסך (app/components/station-analytics/chartLogic.js) + סריקות סטטיות של המסך (RTL, עברית בלבד, בלי תאריך לועזי, CSS בהיקף).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const C = await L('app/components/station-analytics/chartLogic.js');
const read = (rel) => fs.readFileSync(path.join(process.env.PROJ, rel), 'utf8');

test('fmtPct / fmtInt / fmtAvg: null and non-finite show a dash, never 0% or NaN', () => {
  assert.equal(C.fmtPct(null), '—');
  assert.equal(C.fmtPct(NaN), '—');
  assert.equal(C.fmtPct(undefined), '—');
  assert.equal(C.fmtPct(0), '0%');
  assert.equal(C.fmtPct(0.04), '4.0%');
  assert.equal(C.fmtPct(0.5), '50%');
  assert.equal(C.fmtPct(1), '100%');
  assert.equal(C.fmtPct(2), '200%'); // לא נחתך (ר' בדיקת registered > form_start)
  assert.equal(C.fmtInt(null), '—');
  assert.equal(C.fmtInt(1234), '1,234');
  assert.equal(C.fmtAvg(3), '3');
  assert.equal(C.fmtAvg(3.5714), '3.6');
});

test('deltaInfo: direction, absolute difference for counts, percentage points for rates, null when nothing to compare', () => {
  assert.deepEqual(C.deltaInfo(5, 3), { dir: 'up', text: '2' });
  assert.deepEqual(C.deltaInfo(1, 4), { dir: 'down', text: '3' });
  assert.deepEqual(C.deltaInfo(4, 4), { dir: 'same', text: 'ללא שינוי' });
  assert.equal(C.deltaInfo(4, null), null);
  assert.equal(C.deltaInfo(null, 4), null);
  assert.deepEqual(C.deltaInfo(0.1, 0.05, 'rate'), { dir: 'up', text: '5.0 נק׳ אחוז' });
  assert.deepEqual(C.deltaInfo(0.05, 0.25, 'rate'), { dir: 'down', text: '20 נק׳ אחוז' });
  assert.equal(C.deltaInfo(0.1, 0.1, 'rate').dir, 'same');
  assert.deepEqual(C.deltaInfo(1, 0.5), { dir: 'up', text: '0.5' });
});

test('niceScale: integer ticks for small counts, round steps for big ones, never zero / NaN', () => {
  assert.deepEqual(C.niceScale(0), { max: 1, ticks: [0, 1] });
  assert.deepEqual(C.niceScale(3), { max: 3, ticks: [0, 1, 2, 3] });
  const s = C.niceScale(87);
  assert.equal(s.max, 100);
  assert.deepEqual(s.ticks, [0, 20, 40, 60, 80, 100]);
  const t = C.niceScale(1234);
  assert.ok(t.max >= 1234 && t.ticks[0] === 0 && t.ticks[t.ticks.length - 1] === t.max);
  assert.deepEqual(C.niceScale(NaN).ticks, [0, 1]);
  const p = C.niceScale(37.5, 4); // אחוזים
  assert.ok(p.max >= 37.5);
});

test('presetRange: today / 7 / 30 end on the Israeli today key and include it', () => {
  assert.deepEqual(C.presetRange('today', '2026-10-12'), { from: '2026-10-12', to: '2026-10-12' });
  assert.deepEqual(C.presetRange('7', '2026-10-12'), { from: '2026-10-06', to: '2026-10-12' });
  assert.deepEqual(C.presetRange('30', '2026-10-12'), { from: '2026-09-13', to: '2026-10-12' });
  assert.deepEqual(C.presetRange('7', '2026-01-03'), { from: '2025-12-28', to: '2026-01-03' });
  assert.equal(C.presetRange('custom', '2026-10-12'), null);
});

test('dayBands: right-to-left (first day at the right edge), bands tile the plot exactly', () => {
  const b = C.dayBands(4, 10, 400);
  assert.equal(b.length, 4);
  assert.equal(b[0].x + b[0].band, 410); // היום הראשון נוגע בקצה הימני
  assert.equal(b[3].x, 10); // האחרון בקצה השמאלי
  assert.ok(b.every((x) => x.band === 100));
  assert.deepEqual(C.dayBands(0, 0, 100), []);
});

test('labelStride: never more labels than fit', () => {
  assert.equal(C.labelStride(7, 700), 1);
  assert.equal(C.labelStride(30, 700), 3);
  assert.equal(C.labelStride(180, 300), 36);
  assert.equal(C.labelStride(0, 300), 1);
});

// ---- סריקות סטטיות של קבצי המסך
test('static: no English UI strings in the screen (attribute literals and visible JSX text contain Hebrew)', () => {
  for (const f of ['app/components/station-analytics/StationAnalyticsPage.js', 'app/components/station-analytics/StationCharts.js']) {
    const src = read(f);
    const bad = [];
    for (const m of src.matchAll(/(?:aria-label|title|placeholder|data-tip|label|caption|heading|text)=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      const s = (m[1] || m[2] || '').replace(/\$\{[^}]*\}/g, '');
      if (/[A-Za-z]{3,}/.test(s) && !/[֐-׿]/.test(s)) bad.push(s);
    }
    assert.deepEqual(bad, [], `${f}: ${bad.join(' | ')}`);
    const jsx = [...src.matchAll(/>([^<>{}\n]{3,})</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-z]{3,}/.test(t) && !/[֐-׿]/.test(t) && !/[?:&|=;()]/.test(t));
    assert.deepEqual(jsx, [], `${f}: ${jsx.join(' | ')}`);
  }
});

test('static: no Gregorian dates rendered - dates go through the Hebrew helpers only', () => {
  for (const f of ['app/components/station-analytics/StationAnalyticsPage.js', 'app/components/station-analytics/StationCharts.js', 'app/components/station-analytics/chartLogic.js']) {
    const src = read(f);
    assert.ok(!/toLocaleDateString|toDateString|DateTimeFormat\('he|toISOString\(\)\.slice/.test(src), f);
  }
  assert.ok(/hDateShort|dayTitle/.test(read('app/components/station-analytics/StationAnalyticsPage.js')));
});

test('static: CSS rules are all scoped under .gm-ds and use palette tokens (no raw hex besides white)', () => {
  const css = read('app/components/station-analytics/station-analytics.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  const re = /([^{}]+)\{[^{}]*\}/g;
  let m;
  while ((m = re.exec(css))) {
    const head = m[1].trim();
    if (head.startsWith('@media')) continue;
    selectors.push(head.replace(/^@media[^{]*\{/, '').trim());
  }
  const unscoped = selectors.filter((s) => s && s.split(',').some((p) => !/\.gm-ds/.test(p) && !/^@/.test(p.trim())));
  assert.deepEqual(unscoped, []);
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.ok(hex.every((h) => ['#fff', '#ffffff'].includes(h.toLowerCase())), `hex לא מטוקן: ${hex.join(',')}`);
});

test('static: charts use only the two validated series tokens; every chart has a table view; RTL root', () => {
  const css = read('app/components/station-analytics/station-analytics.css');
  assert.ok(/--sa-s1:var\(--gm-navy-500\)/.test(css) && /--sa-s2:var\(--gm-gold-b\)/.test(css));
  const page = read('app/components/station-analytics/StationAnalyticsPage.js');
  assert.ok(/dir="rtl"/.test(page));
  assert.ok(/ViewToggle/.test(page) && /DataTable/.test(page));
});

test('static: the public event tracker sends only {type, sid} and never reads names, phones, cookies or storage beyond sessionStorage', () => {
  const src = read('app/components/kiosk/stationEvents.js');
  assert.ok(/JSON\.stringify\(\{ type, sid: sessionId\(\) \}\)/.test(src));
  assert.ok(!/localStorage|document\.cookie|navigator\.userAgent/.test(src));
});

test('static: KioskPublic reports events only through trackStationEvent (visit / availability / form_start); the register route owns the register event', () => {
  const kp = read('app/components/kiosk/KioskPublic.js');
  assert.ok(/trackStationEvent\('visit'\)/.test(kp) && /trackStationEvent\('availability'\)/.test(kp) && /trackStationEvent\('form_start'\)/.test(kp));
  assert.ok(!/trackStationEvent\('register'\)/.test(kp));
  assert.ok(/recordRegistrationEvent/.test(read('app/api/public-kiosk/register/route.js')));
});

test('static: the admin hub registers the screen and the page label exists', () => {
  assert.ok(/station-analytics/.test(read('lib/adminHubCatalog.js')));
  assert.ok(/'\/station-analytics'/.test(read('lib/menu/pageLabels.js')));
});
