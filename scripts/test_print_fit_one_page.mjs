// בדיקות "הזמנה מודפסת תמיד בעמוד אחד" (דיווחים 6f173798 + 7d921d3b, נווה יעקב): lib/printFitOnePage.js (החלטה טהורה + DOM מדומה)
// ובדיקות מבנה סטטיות של app/print/order/page.js וההגדרה print_order_fit_one_page. מספר העמודים האמיתי בהדפסה נבדק בדפדפן headless (ר' הערות הענף) - לא כאן.
// הרצה (מהשורש): node scripts/test_print_fit_one_page.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideFit, fitOrdersToOnePage, FIT_TARGET_PX, FIT_MIN_SCALE, PAGE_CONTENT_HEIGHT_PX } from '../lib/printFitOnePage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0; let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; process.exitCode = 1; console.error('  FAIL -', name, '\n        ', e.stack || e.message); }
}

await t('גובה העמוד: A4 297 מ"מ פחות שוליים 10+15 = 272 מ"מ (~1028px), יעד עם מרווח ביטחון', () => {
  assert.ok(Math.abs(PAGE_CONTENT_HEIGHT_PX - 1028.0) < 1);
  assert.ok(FIT_TARGET_PX < PAGE_CONTENT_HEIGHT_PX && FIT_TARGET_PX > 900);
});

await t('decideFit: נכנס כמו שהוא -> natural, בלי למדוד מצומצם', () => {
  let measured = 0;
  const r = decideFit({ naturalPx: FIT_TARGET_PX - 1, measureCompact: () => { measured++; return 1; } });
  assert.deepEqual(r, { stage: 'natural', scale: 1 });
  assert.equal(measured, 0);
});
await t('decideFit: מצומצם מספיק -> compact בלי הקטנת כתב', () => {
  const r = decideFit({ naturalPx: FIT_TARGET_PX + 200, measureCompact: () => FIT_TARGET_PX - 10 });
  assert.deepEqual(r, { stage: 'compact', scale: 1 });
});
await t('decideFit: עדיין גדול -> scaled עם יחס שמרני (מעוגל כלפי מטה)', () => {
  const r = decideFit({ naturalPx: 3000, measureCompact: () => FIT_TARGET_PX * 2 });
  assert.equal(r.stage, 'scaled');
  assert.ok(r.scale <= 0.5 && r.scale >= 0.49, String(r.scale));
});
await t('decideFit: ענק מעבר לרצפה -> overflow ברצפה, לא קטן יותר', () => {
  const r = decideFit({ naturalPx: 9000, measureCompact: () => FIT_TARGET_PX * 10 });
  assert.equal(r.stage, 'overflow');
  assert.equal(r.scale, FIT_MIN_SCALE);
});
await t('decideFit: מדידה לא תקינה (0/NaN) לא מפילה ולא מקטינה', () => {
  assert.equal(decideFit({ naturalPx: 0, measureCompact: () => 0 }).scale, 1);
  assert.equal(decideFit({ naturalPx: NaN, measureCompact: () => 0 }).scale, 1);
  assert.equal(decideFit({ naturalPx: 5000, measureCompact: () => 0 }).stage, 'compact');
});

// DOM מדומה: כל הזמנה "גבוהה" לפי הכיתות/ה-zoom שהוחלו עליה
function fakeSection({ natural, compact, wrapGain = 1, parentDivider = false }) {
  const classes = new Set();
  const attrs = {};
  const style = { zoom: '' };
  const section = {
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    style,
    removeAttribute: (a) => { delete attrs[a]; },
    setAttribute: (a, v) => { attrs[a] = v; },
    getBoundingClientRect() {
      const base = classes.has('fit-compact') ? compact : natural;
      const z = style.zoom === '' ? 1 : Number(style.zoom);
      return { height: base * z * wrapGain };
    },
    parentElement: { previousElementSibling: parentDivider ? { classList: { contains: (c) => c === 'prep-group-divider' }, getBoundingClientRect: () => ({ height: 50 }) } : null },
    _classes: classes, _attrs: attrs,
  };
  return section;
}
function fakeRoot(sections) {
  const classes = new Set();
  return { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) }, querySelectorAll: () => sections, _classes: classes };
}

await t('fitOrdersToOnePage: הזמנה קטנה לא משתנה בכלל; fit-measure מוסר בסוף', () => {
  const s = fakeSection({ natural: 600, compact: 400 });
  const root = fakeRoot([s]);
  const res = fitOrdersToOnePage(root);
  assert.equal(res[0].stage, 'natural');
  assert.ok(!s._classes.has('fit-compact') && s.style.zoom === '' && s._attrs['data-fit-stage'] === 'natural');
  assert.ok(!root._classes.has('fit-measure'));
});
await t('fitOrdersToOnePage: מצומצם בלבד כשזה מספיק', () => {
  const s = fakeSection({ natural: 1300, compact: 900 });
  const res = fitOrdersToOnePage(fakeRoot([s]));
  assert.equal(res[0].stage, 'compact');
  assert.ok(s._classes.has('fit-compact') && s.style.zoom === '');
});
await t('fitOrdersToOnePage: scaled - התוצאה הסופית נמדדת ונכנסת ליעד (גם כשהשבירה משתפרת עם הזום)', () => {
  const s = fakeSection({ natural: 3000, compact: 2000, wrapGain: 0.9 });
  const res = fitOrdersToOnePage(fakeRoot([s]));
  assert.ok(['scaled', 'overflow'].includes(res[0].stage));
  assert.ok(res[0].finalPx <= FIT_TARGET_PX, `final ${res[0].finalPx} > ${FIT_TARGET_PX}`);
  assert.ok(Number(s.style.zoom) < 1 && Number(s.style.zoom) >= FIT_MIN_SCALE);
});
await t('fitOrdersToOnePage: כותרת קבוצה (הזמנות משלוח) שמורה מהמקום של ההזמנה הראשונה בקבוצה', () => {
  const s = fakeSection({ natural: FIT_TARGET_PX - 20, compact: 500, parentDivider: true });
  const res = fitOrdersToOnePage(fakeRoot([s]));
  assert.equal(res[0].stage, 'compact', 'עם הכותרת (74px) לא נכנס כמו שהוא');
});
await t('fitOrdersToOnePage: קריאה חוזרת מאפסת ומחשבת מחדש (beforeprint)', () => {
  const s = fakeSection({ natural: 2000, compact: 1500 });
  const root = fakeRoot([s]);
  fitOrdersToOnePage(root);
  const z1 = s.style.zoom;
  fitOrdersToOnePage(root);
  assert.equal(s.style.zoom, z1);
});
await t('fitOrdersToOnePage: root ריק/חסר לא זורק', () => {
  assert.deepEqual(fitOrdersToOnePage(null), []);
  assert.deepEqual(fitOrdersToOnePage(fakeRoot([])), []);
});

// ---------------------------------------------------------------- מבנה סטטי
const page = read('app/print/order/page.js');
await t('הדף: ההגדרה כבויה כברירת מחדל ונקראת מ-/api/settings; ההתאמה רצה רק כשהיא true', () => {
  assert.ok(/const \[fitOnePageSetting, setFitOnePageSetting\] = useState\(false\);/.test(page));
  assert.ok(page.includes("settingsData.find(s => s.key === 'print_order_fit_one_page')"));
  assert.ok(page.includes("fitSetting.value === 'true') setFitOnePageSetting(true)"));
  assert.ok(page.includes('if (!fitOnePageSetting || loading || error || orders.length === 0) return undefined;'));
  assert.ok(page.includes('if (fitOnePageSetting) { try { fitOrdersToOnePage(containerRef.current)'));
  assert.ok(page.includes("${fitOnePageSetting ? ' fit-on' : ''}"), 'המראה הנקי (בלי מסגרות) רק עם ההגדרה');
});
await t('הדף: כל הזמנה מסומנת data-fit-section; fit-measure מחקה רוחב הדפסה; כללי batch מחוץ ל-@media print', () => {
  assert.ok(page.includes('data-fit-section=""'));
  assert.ok(/\.print-container\.fit-measure \{[^}]*width: 190mm !important/.test(page));
  const mediaStart = page.indexOf('@media print {');
  const batchIdx = page.indexOf('.batch-print {');
  // הבלוק של @media print נסגר לפני כללי ה-batch (סופרים סוגריים מסולסלים בין הפתיחה לכלל)
  const between = page.slice(mediaStart, batchIdx);
  const opens = (between.match(/\{/g) || []).length; const closes = (between.match(/\}/g) || []).length;
  assert.equal(opens, closes, '@media print סגור לפני .batch-print');
});
await t('ההגדרה: שם+הסבר בעברית, מפתח בוליאני, בקבוצת הדפסה וב-SimLayout, ברירת מחדל ב-seed (org2=true)', () => {
  const meta = read('lib/settingsMetadata.js');
  assert.ok(/print_order_fit_one_page: 'הדפסת הזמנה - תמיד עמוד אחד'/.test(meta));
  assert.ok(/print_order_fit_one_page: 'כשמופעל[^']*כבוי = ההדפסה כמו קודם/.test(meta));
  assert.ok(/SETTINGS_BOOLEAN_KEYS[\s\S]*'print_order_fit_one_page'/.test(meta));
  assert.ok(read('lib/settingsSimLayout.js').includes("'print_order_fit_one_page'"));
  const seed = read('scripts/seed_print_order_fit_one_page_setting.js');
  assert.ok(/key: 'print_order_fit_one_page'/.test(seed) && /trueForOrg: 2/.test(seed) && /seedBoolSetting\(/.test(seed));
});

console.log(`\n${passed} passed, ${failed} failed`);
