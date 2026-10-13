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

const CSS_PAGE = 'app/components/station-analytics/station-analytics.css';
const CSS_CHARTS = 'app/components/station-analytics/station-charts.css';
const stripCss = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '');
// צבע גולמי = hex (לא url(#id)), rgb()/rgba()/hsl()/hsla()
const rawColors = (src) => (src.match(/(?<![\w&(#])#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?)\(/g) || []);

test('static: every CSS rule of the screen is scoped under .gm-ds (page CSS + chart CSS)', () => {
  for (const rel of [CSS_PAGE, CSS_CHARTS]) {
    const css = stripCss(rel).replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    const selectors = [];
    const re = /([^{}]+)\{[^{}]*\}/g;
    let m;
    while ((m = re.exec(css))) {
      const head = m[1].trim();
      if (head.startsWith('@media')) continue;
      selectors.push(head.replace(/^@media[^{]*\{/, '').trim());
    }
    const unscoped = selectors.filter((x) => x && x.split(',').some((part) => !/\.gm-ds/.test(part) && !/^@/.test(part.trim())));
    assert.deepEqual(unscoped, [], rel);
  }
});

test('static: NO hard-coded colors (hex / rgb / hsl) anywhere in the screen - page JSX, page CSS, chart JSX and chart CSS all draw from palette tokens (--gm-*)', () => {
  const files = [
    'app/components/station-analytics/StationAnalyticsPage.js', 'app/components/station-analytics/StationAnalyticsSwitch.js', 'app/station-analytics/page.js', 'app/station-analytics/layout.js',
    'app/components/station-analytics/StationCharts.js', 'app/components/station-analytics/chartLogic.js',
  ];
  for (const f of files) assert.deepEqual(rawColors(read(f)), [], f);
  for (const rel of [CSS_PAGE, CSS_CHARTS]) assert.deepEqual(rawColors(stripCss(rel)), [], rel);
  assert.ok(/--gm-/.test(stripCss(CSS_CHARTS)), 'הגרפים נבנים מטוקני הפלטה');
});

test('static: the page-level CSS (everything that is not a chart) declares no color / size / radius / spacing of its own - only the refresh dimming', () => {
  const css = stripCss(CSS_PAGE);
  assert.ok(!/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-radius)?|font-size|font-weight|width|height|padding|margin|gap|box-shadow)\s*:/.test(css), 'כלל עיצוב מקומי בדף שאינו גרף');
  assert.ok(/\.sa-busy/.test(css));
});

test('static: classes used by the page outside the chart components are palette / settings-kit classes (only a short allow-list of local chart-container classes)', () => {
  const page = read('app/components/station-analytics/StationAnalyticsPage.js');
  const classText = [...page.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] || m[2] || '').join(' ');
  const local = new Set((classText.match(/(?<![\w-])sa-[\w-]+/g) || []));
  const allowed = new Set(['sa-panel', 'sa-card', 'sa-card-h', 'sa-charts', 'sa-tiles', 'sa-notes', 'sa-busy']);
  const extra = [...local].filter((c) => !allowed.has(c));
  assert.deepEqual(extra, [], `מחלקות מקומיות שאינן של גרפים: ${extra.join(', ')}`);
  // רכיבי הפלטה / ערכת ההגדרות שהמסך חייב להשתמש בהם
  for (const cls of ['nb-w', 'nb-head', 'nb-ic', 'topbar', 'back', 'hf-bar', 'seg pill', 'st-sec', 'adm-h', 'adm-rows', 'tblw', 'rtbl', 'chip', 'empty st-state', 'btn ghost sm', 'tabs', 'tab', 'tico', 'st-stab', 'st-toptabs', 'st-saverow']) {
    assert.ok(page.includes(cls), `חסר רכיב פלטה / ערכת הגדרות: ${cls}`);
  }
  // המסך לא כותב משלו: טבלה, שדה, כפתור, שבב או באנר בעיצוב מקומי
  assert.ok(!/<select\b/.test(page) && !/<input\b/.test(page), 'בקרות טופס מקומיות');
  assert.ok(/RangeDialog/.test(page) && /A5PortalRoot/.test(page), 'בחירת טווח: הלוח העברי של הפלטה (OcHebrewCalendar) דרך RangeDialog');
});

test('static: charts use only the two validated series tokens (blue / gold, built from palette tokens); every chart has a table view; RTL root', () => {
  const css = stripCss(CSS_CHARTS);
  assert.ok(/--sa-blue:color-mix\(in srgb,var\(--gm-sky-400\) 35%,var\(--gm-navy-500\)\)/.test(css));
  assert.ok(/--sa-gold:color-mix\(in srgb,var\(--gm-gold-b\) 85%,var\(--gm-gold-d\)\)/.test(css));
  assert.equal((css.match(/--sa-(blue|gold):/g) || []).length, 2);
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

test('splinePath: passes through every point, stays monotone (no overshoot) and handles 0 / 1 / 2 points', () => {
  assert.equal(C.splinePath([]), '');
  assert.equal(C.splinePath([{ x: 0, y: 0 }]), '');
  const two = C.splinePath([{ x: 0, y: 10 }, { x: 10, y: 20 }]);
  assert.match(two, /^M0,10 C/);
  const pts = [{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 40 }, { x: 30, y: 38 }];
  const d = C.splinePath(pts);
  assert.equal((d.match(/C/g) || []).length, 3);
  for (const p of pts) assert.ok(d.includes(`${p.x},${p.y}`));
  const ys = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => parseFloat(m[2]));
  assert.ok(Math.min(...ys) >= 5 - 1e-9 && Math.max(...ys) <= 40 + 1e-9, 'העקומה חורגת מעבר לנקודות');
  assert.ok(!/NaN/.test(d));
});

test('splitSegments: gaps (null) split the line into consecutive runs', () => {
  const a = { x: 1, y: 1 };
  assert.deepEqual(C.splitSegments([a, a, null, a, null, null, a, a, a]).map((s) => s.length), [2, 1, 3]);
  assert.deepEqual(C.splitSegments([null, null]), []);
});

test('funnelGeometry: bands never exceed the ribbon, widths follow counts (17%..100%), joints carry the conversion tag and name a non-adjacent parent', () => {
  const stages = [
    { key: 'visits', count: 420 },
    { key: 'availability', count: 168, parent: 'visits', rateFromParent: 0.4 },
    { key: 'formStart', count: 74, parent: 'visits', rateFromParent: 74 / 420 },
    { key: 'registered', count: 41, parent: 'formStart', rateFromParent: 41 / 74 },
    { key: 'opened', count: 29, parent: 'registered', rateFromParent: 29 / 41 },
  ];
  const g = C.funnelGeometry(stages, { width: 600, labelWidth: 150, parentLabels: { visits: 'הנכנסים', registered: 'מי שמילאו פרטים' } });
  assert.equal(g.bands.length, 5);
  assert.ok(g.bands.every((b) => b.x >= 0 && b.x + b.w <= g.ribW + 1e-9));
  assert.ok(g.bands.every((b, i) => i === 0 || b.w <= g.bands[i - 1].w + 1e-9));
  assert.equal(g.bands[0].w, g.ribW * 0.47 * 2);
  assert.ok(g.bands[4].half >= g.ribW * 0.47 * 0.17 - 1e-9);
  assert.equal(g.joints.length, 4);
  assert.equal(g.joints[0].tag, '40%'); // availability: ההורה visits הוא גם השלב הקודם - בלי תווית הורה
  assert.equal(g.joints[1].tag, '18% מהנכנסים'); // formStart: ההורה visits אינו הקודם (availability) - התווית מציינת אותו
  assert.equal(g.joints[2].tag, '55%'); // registered מ-formStart הקודם
  assert.equal(g.joints[3].tag, '71%'); // opened מ-registered שהוא גם הקודם
  assert.ok(g.height > 0 && !/NaN/.test(JSON.stringify(g)));
  assert.deepEqual(C.funnelGeometry([], { width: 600, labelWidth: 150 }).bands, []);
});

test('gaugeDash / compareRows: clamp, null-safe, widths relative to the largest', () => {
  const full = C.gaugeDash(88, 1);
  assert.equal(full.offset, 0);
  assert.ok(Math.abs(full.length - Math.PI * 88) < 1e-9);
  assert.equal(C.gaugeDash(88, 0).offset, C.gaugeDash(88, 0).length);
  assert.equal(C.gaugeDash(88, 7).offset, 0);
  assert.equal(C.gaugeDash(88, null).offset, C.gaugeDash(88, null).length);
  const rows = C.compareRows(5, 10, null);
  assert.deepEqual(rows.map((r) => r.key), ['today', 'yesterday', 'avg']);
  assert.equal(rows[1].pct, 100);
  assert.equal(rows[0].pct, 50);
  assert.equal(rows[2].value, null);
  assert.equal(C.compareRows(0, 0, 0).every((r) => r.pct === 0), true);
});
