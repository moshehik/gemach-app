// צורות הטופס של האשף החדש: אשף שלבים (ברירת מחדל) / טופס רציף בעמוד אחד (new_order_layout='continuous'). בלי DB, בלי רשת, בלי דפדפן.
// נבדק: ההגדרה רשומה (שם, הסבר, אפשרויות, מקום בעמוד ההגדרות) וברירת המחדל = אשף; שתי הצורות מציגות את אותם רכיבי שלב; שער הנעילה
// (NL.stepGate) זהה בדיוק לבדיקה שהייתה ב-go() באשף; לוגיקה טהורה של הטופס הרציף (שלבים מוצגים, התקדמות, פעולת "המשך", גלילה).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as N from '../../app/components/new-order/newOrderLogic.js';
import * as LL from '../../app/components/new-order/layoutLogic.js';
import { DEFAULT_NEW_ORDER_LAYOUT, NEW_ORDER_LAYOUTS, NEW_ORDER_LAYOUT_KEY, resolveNewOrderLayout } from '../../lib/newOrderLayout.js';
import { SETTINGS_HEBREW_NAMES, SETTINGS_HEBREW_NOTES, SETTINGS_ORDER, SETTINGS_SELECT_OPTIONS, classifySettingField } from '../../lib/settingsMetadata.js';
import { SECTIONS } from '../../lib/settingsSimLayout.js';

const PROJ = process.env.PROJ;
const DIR = path.join(PROJ, 'app/components/new-order');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const strip = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('ההגדרה new_order_layout: ברירת מחדל = אשף; רק "continuous" בדיוק מדליק את הרציף (חסר / ריק / שגוי = אשף)', () => {
  assert.equal(NEW_ORDER_LAYOUT_KEY, 'new_order_layout');
  assert.equal(DEFAULT_NEW_ORDER_LAYOUT, 'wizard');
  for (const v of [undefined, null, '', ' ', 'wizard', 'Continuous', 'continuos', 'true', 0, false]) assert.equal(resolveNewOrderLayout(v), 'wizard', String(v));
  assert.equal(resolveNewOrderLayout('continuous'), 'continuous');
  assert.equal(resolveNewOrderLayout(' continuous '), 'continuous');
  assert.deepEqual(NEW_ORDER_LAYOUTS.map(o => o.value), ['wizard', 'continuous']);
});

test('ההגדרה רשומה ב-lib/settingsMetadata: שם עברי, הסבר, select עם שתי האפשרויות, בקטגוריית "הזמנות", ובעמוד ההגדרות החדש (סעיף "מסך ההזמנה")', () => {
  const k = NEW_ORDER_LAYOUT_KEY;
  assert.ok(/[א-ת]/.test(SETTINGS_HEBREW_NAMES[k]), 'שם עברי');
  assert.ok(/[א-ת]/.test(SETTINGS_HEBREW_NOTES[k]) && SETTINGS_HEBREW_NOTES[k].includes('ברירת מחדל'), 'הסבר עם ברירת המחדל');
  assert.equal(SETTINGS_SELECT_OPTIONS[k], NEW_ORDER_LAYOUTS, 'אותה רשימה שההכרעה בקוד משתמשת בה');
  assert.ok(SETTINGS_ORDER['הזמנות'].includes(k));
  assert.equal(classifySettingField(k, 'select', 'wizard'), 'select');
  assert.equal(classifySettingField(k, null, 'continuous'), 'select', 'גם בלי type מפורש בשורה');
  const sec = SECTIONS.find(s => s.keys.includes(k));
  assert.ok(sec && sec.view === 'sys' && sec.tab === 'ord' && sec.id === 'screen', 'סעיף "מסך ההזמנה" בלשונית הזמנות');
  // האשף הישן לא קורא את ההגדרה (תמיד אותו טופס)
  assert.ok(!fs.readFileSync(path.join(PROJ, 'app/orders/new/LegacyNewOrderPage.js'), 'utf8').includes(k));
});

test('אין שורת DB נכתבת בבנייה: סקריפט ה-seed הוא dry-run כברירת מחדל, יוצר רק כשחסר ולא דורס', () => {
  const src = fs.readFileSync(path.join(PROJ, 'scripts/seed_new_order_layout_setting.js'), 'utf8');
  assert.match(src, /rest\.includes\('--write'\)/);
  assert.match(src, /already exists[\s\S]*never overwritten/);
  assert.match(src, /'wizard'/);
});

test('שתי הצורות מציגות את אותם רכיבי שלב (stepViews.js) ואת אותו controller - בלי עותק של שלב', () => {
  const views = strip(read('stepViews.js'));
  for (const [k, c] of [['customer', 'StepCustomer'], ['dates', 'StepDates'], ['delivery', 'StepDelivery'], ['items', 'StepItems'], ['summary', 'StepSummary'], ['payment', 'StepPayment']]) {
    assert.match(views, new RegExp(`import ${c} from './${c}'`));
    assert.match(views, new RegExp(`${k}: ${c}`));
  }
  const a5 = strip(read('NewOrderA5.js'));
  const cont = strip(read('LayoutContinuous.js'));
  assert.match(a5, /import \{ STEP_VIEW \} from '.\/stepViews'/);
  assert.match(cont, /import \{ STEP_VIEW \} from '.\/stepViews'/);
  assert.ok(!/import Step[A-Z]/.test(a5) && !/import Step[A-Z]/.test(cont), 'אף אחת מהצורות לא מייבאת שלב ישירות');
  assert.match(a5, /<LayoutContinuous ctl=\{ctl\} \/> : <LayoutWizard ctl=\{ctl\} \/>/);
  assert.equal((a5.match(/useNewOrderController\(/g) || []).length, 1, 'controller אחד לשתי הצורות');
  assert.ok(!/useNewOrderController|fetch\(/.test(cont), 'הצורה הרציפה לא מחזיקה state / קריאות משלה');
  // החלונות / הטוסט / הבאנר / מגן הטיוטה: מחוץ לצורות, משותפים
  assert.match(a5, /<Dialog ctl=\{ctl\} layer=\{1\} \/>/);
  assert.match(a5, /<NoBanner /);
  assert.match(read('useNewOrderController.js'), /window\.__gmDirty = \(\) => hasStartedOrderRef\.current/);
});

test('go() ו"נעילה" מקור יחיד: NL.stepGate; ללא layout continuous - תוצאה זהה בדיוק לבדיקה הישנה (openInfo + deliveryError אחרי שלב המשלוח)', () => {
  const ctl = read('useNewOrderController.js');
  assert.match(ctl, /const g = gate\(key\);\s*if \(!g\.open\) \{ say\('info', g\.reason\); return; \}/);
  assert.match(ctl, /NL\.stepGate\(order, \{ deliveryError, customerConfirmed \}, key\)/);
  // האורקל = הקוד הקודם של go() (לפני ההוצאה ל-stepGate)
  const oldGate = (order, deliveryError, key) => {
    const openInfo = N.stepOpenInfo(order);
    const idx = N.STEP_KEYS.indexOf(key);
    if (!openInfo[key].open) return { open: false, reason: openInfo[key].reason };
    if (idx > N.STEP_KEYS.indexOf('delivery') && deliveryError) return { open: false, reason: deliveryError };
    return { open: true, reason: '' };
  };
  let n = 0;
  for (const customerId of ['', 'c1']) for (const eventDate of ['', '2026-11-01']) for (const isAbroad of [false, true]) for (const toDate of ['', '2026-11-05'])
    for (const items of [[], [{ x: 1 }]]) for (const deliveryError of ['', 'עיר חסרה']) for (const key of N.STEP_KEYS) {
      const order = { customerId, eventDate, isAbroad, fromDate: eventDate, toDate, items };
      assert.deepEqual(N.stepGate(order, { deliveryError }, key), oldGate(order, deliveryError, key), JSON.stringify([order, deliveryError, key]));
      assert.deepEqual(N.stepGate(order, { deliveryError, customerConfirmed: true }, key), oldGate(order, deliveryError, key));
      n++;
    }
  assert.ok(n > 300);
});

test('stepGate: לקוח שלא אושר ("המשך": חסימה / חריגה) נועל את כל השלבים אחרי הלקוח, גם כשנבחר ברשימה; שלב הלקוח תמיד פתוח', () => {
  const order = { customerId: 'c1', eventDate: '2026-11-01', isAbroad: false, items: [{ x: 1 }] };
  assert.equal(N.stepGate(order, { customerConfirmed: false }, 'customer').open, true);
  for (const k of ['dates', 'delivery', 'items', 'summary', 'payment']) {
    const g = N.stepGate(order, { customerConfirmed: false }, k);
    assert.equal(g.open, false, k);
    assert.equal(g.reason, N.LOCK_REASON_CUSTOMER_UNCONFIRMED);
    assert.equal(N.stepGate(order, { customerConfirmed: true }, k).open, true, k);
  }
  // הסיבה הקיימת של האשף נשמרת כשהשלב נעול מסיבה אחרת (אין לקוח / תאריך)
  assert.equal(N.stepGate({ customerId: '', items: [] }, { customerConfirmed: false }, 'dates').reason, N.LOCK_REASONS.noCustomer);
  assert.equal(N.stepGate({ customerId: 'c1', eventDate: '', items: [] }, { customerConfirmed: true }, 'items').reason, N.LOCK_REASONS.noDates);
  assert.equal(N.stepGate({ customerId: 'c1', eventDate: '2026-11-01', items: [] }, {}, 'payment').reason, N.LOCK_REASONS.noItems);
});

test('הקובץ המשותף: go() בהקשר wizard לא גולל לגוש (גלילה למעלה כמו תמיד) ובהקשר continuous - גלילה לגוש; itemsListWanted באשף = שלב הפריטים', () => {
  const ctl = read('useNewOrderController.js');
  assert.match(ctl, /const jumpTo = \(key\) => \{[\s\S]*if \(continuous && scrollToSection\(key\)\) return;[\s\S]*window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\);/);
  assert.match(ctl, /const goStep = \(key\) => \{ setStep\(NL\.STEP_KEYS\.indexOf\(key\)\); jumpTo\(key\); \};/);
  assert.match(ctl, /\? NL\.stepGate\([^)]*\)[^:]*\.open : stepKey === 'items'/);
  assert.match(ctl, /const layout = resolveNewOrderLayout\(settings\.new_order_layout\)/);
  // אישור הלקוח נקבע רק במסלולים שעוברים את בדיקות "המשך"
  assert.equal((ctl.match(/setConfirmedCustomerId\(/g) || []).length, 3, '3 מסלולי המשך (קיים / רשימה / חדש)');
});

test('שלבים מוצגים בטופס הרציף: משלוח רק כש-showMode / showDelivery של השער הקיים; בלי שינוי בסדר', () => {
  const all = N.STEP_KEYS;
  assert.deepEqual(LL.visibleSectionKeys({}), all.filter(k => k !== 'delivery' || N.deliveryStepVisibility({}).showDelivery || N.deliveryStepVisibility({}).showMode));
  // ברירת מחדל ללא הגדרות: delivery_show_in_order !== 'false' אבל enable_deliveries חסר -> showDelivery false, showMode false -> בלי משלוח
  assert.ok(!LL.visibleSectionKeys({}).includes('delivery'));
  assert.deepEqual(LL.visibleSectionKeys({ enable_deliveries: 'true' }), all);
  assert.deepEqual(LL.visibleSectionKeys({ enable_deliveries: 'true', delivery_show_in_order: 'false' }), all.filter(k => k !== 'delivery'), 'הכרטיס מוסתר בהגדרות');
  assert.ok(LL.visibleSectionKeys({ phone_order_marker_enabled: 'true' }).includes('delivery'), 'אופן ההזמנה (טלפונית / סניף) חי בשלב המשלוח - נשאר');
  assert.ok(LL.visibleSectionKeys({ track_branch_on_order: 'true', enable_deliveries: 'false' }).includes('delivery'));
  assert.deepEqual(LL.visibleSectionKeys({ enable_deliveries: 'true' }).slice(0, 2), ['customer', 'dates']);
});

test('sectionProgress: done / cur (הראשון שלא הושלם) / fut; אחרי שמירה הכול done', () => {
  const keys = ['customer', 'dates', 'items', 'summary', 'payment'];
  const st = (done, saved = false) => LL.sectionProgress(keys, done, saved).map(x => x.state).join(',');
  assert.equal(st({}), 'cur,fut,fut,fut,fut');
  assert.equal(st({ customer: true }), 'done,cur,fut,fut,fut');
  assert.equal(st({ customer: true, dates: true, items: true, summary: true }), 'done,done,done,done,cur');
  assert.equal(st({ dates: true }), 'cur,done,fut,fut,fut', 'לפי הנתונים: ההתקדמות לא מניחה סדר');
  assert.equal(st({}, true), 'done,done,done,done,done');
});

test('sectionDoneFlags: לקוח/תאריכים/פריטים לפי הנתונים והשער; תשלום = נשמר', () => {
  const open = () => ({ open: true });
  const shut = () => ({ open: false });
  const ctl = { order: { customerId: 'c1' }, datesFilled: true, activeItems: [{ a: 1 }], saved: null };
  assert.deepEqual(LL.sectionDoneFlags(ctl, open), { customer: true, dates: true, delivery: true, items: true, summary: true, payment: false });
  assert.deepEqual(LL.sectionDoneFlags(ctl, shut), { customer: false, dates: false, delivery: false, items: false, summary: false, payment: false });
  assert.equal(LL.sectionDoneFlags({ ...ctl, saved: { orderId: 1 } }, open).payment, true);
  assert.equal(LL.sectionDoneFlags({ ...ctl, activeItems: [] }, open).items, false);
});

test('stepNextAction: אותם תנאי כיבוי ואותן קריאות go() כמו שורת הניווט של האשף; skipDelivery מדלג על המשלוח', () => {
  const calls = [];
  const base = { order: { customerId: '' }, datesFilled: false, deliveryError: '', activeItems: [], go: (i) => calls.push(i), proceedToStep2: () => calls.push('p2') };
  const t = (ctl, k, o) => LL.stepNextAction(ctl, k, o);
  assert.equal(t(base, 'customer')[1], true);
  assert.equal(t({ ...base, order: { customerId: 'c' } }, 'customer')[1], false);
  assert.equal(t(base, 'customer')[2], base.proceedToStep2);
  assert.deepEqual([t(base, 'dates')[0], t(base, 'dates')[1]], ['המשך למשלוח', true]);
  t(base, 'dates')[2](); t(base, 'delivery')[2](); t(base, 'items')[2](); t(base, 'summary')[2]();
  assert.deepEqual(calls.splice(0), [2, 3, 4, 5], 'האינדקסים שהיו קבועים בקוד הישן של Nav');
  const skip = t({ ...base, datesFilled: true }, 'dates', { skipDelivery: true });
  assert.deepEqual([skip[0], skip[1]], ['המשך לבחירת פריטים', false]); skip[2]();
  assert.deepEqual(calls.splice(0), [3]);
  assert.equal(t({ ...base, deliveryError: 'x' }, 'delivery')[1], true);
  assert.equal(t(base, 'items')[1], true);
  assert.equal(t({ ...base, activeItems: [1] }, 'items')[1], false);
  assert.equal(t(base, 'summary')[1], false);
  assert.equal(t(base, 'payment'), null);
  assert.match(strip(read('NewOrderA5.js')), /const next = stepNextAction\(ctl, k\);/);
});

test('scrollToSection: בלי DOM - false; עם DOM - גלילה חלקה, ו-prefers-reduced-motion = auto', () => {
  assert.equal(LL.scrollToSection('items'), false);
  const calls = [];
  const el = { scrollIntoView: (o) => calls.push(o) };
  globalThis.document = { getElementById: (id) => (id === 'noSec-items' ? el : null) };
  try {
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    assert.equal(LL.scrollToSection('items'), true);
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    assert.equal(LL.scrollToSection('items'), true);
    assert.equal(LL.scrollToSection('dates'), false, 'גוש שלא קיים בעמוד');
  } finally { delete globalThis.document; delete globalThis.window; }
  assert.deepEqual(calls, [{ behavior: 'smooth', block: 'start' }, { behavior: 'auto', block: 'start' }]);
});

test('הטופס הרציף: גוש נעול הוא inert ומציג רמז; הטופס inert אחרי שמירה; העיצוב נשען על המחלקות והעמודות של הפלטה', () => {
  const cont = read('LayoutContinuous.js');
  assert.match(cont, /<div className="no-sec-body" inert=\{locked\}>/);
  assert.match(cont, /<div className="no-flow" id="noFlow" inert=\{!!ctl\.saved\}>/);
  assert.match(cont, /יש להשלים את השלב הקודם/);
  assert.match(cont, /className="pbars mini"/);
  const css = fs.readFileSync(path.join(DIR, 'css/new-order.css'), 'utf8');
  assert.match(css, /\.gm-ds\.gm-no \.no-sec\.locked \.no-sec-body\{[^}]*opacity:\.5/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.gm-ds\.gm-no \.no-sec-body\{transition:none\}/);
  assert.match(css, /\.gm-ds\.gm-no \.items-split\{display:grid;grid-template-columns:minmax\(0,1fr\) 280px/);
  assert.match(css, /@media \(max-width:760px\)\{[^@]*\.items-split\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('גוש התשלום בטופס הרציף: אותו לחצן סיום כמו באשף (disabled=busy, aria-busy, ctl.saveOrder), וגם אחרי שמירה שורת "הזמנה חדשה" של Nav', () => {
  const cont = read('LayoutContinuous.js');
  assert.match(cont, /disabled=\{busy\} aria-busy=\{ctl\.saving\} onClick=\{ctl\.saveOrder\}/);
  assert.match(cont, /const busy = ctl\.saving \|\| ctl\.isProcessingCredit;/);
  assert.match(strip(read('NewOrderA5.js')), /\{continuous && ctl\.saved \? <Nav ctl=\{ctl\} \/> : null\}/);
});

test('התאמות לעיצוב העדכני: הפריטים בקלף אחד עם שתי העמודות, "הוספת פריט" עם שדה דגם, סוג הזמנה בגלולה (אותו isPhoneOrder), בלי "שלב N מתוך" ובלי מה שהבעלים הסיר', () => {
  const items = strip(read('StepItems.js'));
  assert.match(items, /<OneCard>\s*<div className="items-split">\s*<div className="items-main"><AddItem ctl=\{ctl\} \/><\/div>\s*<div className="items-cart"><Cart ctl=\{ctl\} \/><\/div>/);
  assert.equal((items.match(/<OneCard>/g) || []).length, 1, 'קלף אחד בלבד');
  assert.match(items, /title="הוספת פריט"/);
  assert.match(items, /קוד: \$\{code\}/);
  assert.ok(!/הדגם שנבחר|pickedModel" style|N פנויות|פנויות|אזל<|החל מ|הערות כלליות/.test(items.replace(/אזלו/g, '')), 'החלטות הבעלים');
  const del = strip(read('StepDelivery.js'));
  assert.match(del, /<SegPill id="orderSeg"[^>]*value=\{!!o\.isPhoneOrder\} onChange=\{\(v\) => set\(\{ isPhoneOrder: v, branch: v \? '' : o\.branch \}\)\}/);
  assert.ok(!/noPhoneOrder/.test(del), 'המתג הוחלף');
  const all = ['NewOrderA5.js', 'LayoutContinuous.js', 'StepDates.js'].map(read).join('\n');
  assert.ok(!/hero-step|מתוך \d|מתוך \$\{/.test(all), 'שורת "שלב N מתוך 6" הוסרה בהחלטת בעלים');
  assert.ok(!/greg|לועזי/i.test(strip(read('StepDates.js'))), 'תאריכים עבריים בלבד - בלי תאריך לועזי בכותרת התאריך');
});

test('שלב התשלום: קלף אחד (.card.one) עם הטופס ו"תשלומים שנרשמו" בתוכו, בלי פאנל נפרד', () => {
  const pay = strip(read('StepPayment.js'));
  assert.equal((pay.match(/<OneCard>/g) || []).length, 1);
  assert.match(pay, /<OneCard>\s*<div className=\{`pay-split\$\{hasPays \? ' has-side' : ''\}`\}>\s*<div className="pay-main">/);
  assert.match(pay, /<div className="pay-side">/);
  const css = fs.readFileSync(path.join(DIR, 'css/new-order.css'), 'utf8');
  const side = css.match(/\.gm-ds\.gm-no \.pay-side\{[^}]*\}/)[0];
  assert.ok(!/background|border:|box-shadow|padding:/.test(side), 'ל-.pay-side אין עוד כרטיס משלו');
  assert.match(css, /\.gm-ds\.gm-no \.pay-split\.has-side \.pay-main\{[^}]*border-inline-end:1px solid/);
});
