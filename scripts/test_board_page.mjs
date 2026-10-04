// בדיקת חוזה לדף "לוח חודשי" (/board) אחרי המעבר לעיצוב החדש (תשובות הבעלים 4.10.2026, scratch/board-build/answers-board.json):
// מה שהבעלים הסיר לא חזר, מה שנשאר קיים, אין תאריך לועזי בתאים, "החודש הנוכחי" בגובה מתג התצוגה, השער page:board נשאר,
// חוזי ה-API של הדף הקודם לא השתנו, אין alert/confirm של הדפדפן, והלוגיקה הטהורה (boardLogic.js) נכונה.
// בלי DB, רשת ודפדפן. הרצה: node scripts/test_board_page.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה חזותית מול העיצוב: scripts/board-bg-audit (cmp.mjs, views.mjs, interact.mjs).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
// boardLogic.js משתמש ב-lib/lateReturn.js (ייבוא בלי סיומת) - נטען דרך ה-hooks של scripts/schedule-tests ('@/', סיומות)
const HERE = path.dirname(fileURLToPath(import.meta.url));
process.env.PROJ = process.env.PROJ || path.resolve(HERE, '..');
process.env.SPDIR = process.env.SPDIR || path.join(HERE, 'schedule-tests');
register(pathToFileURL(path.join(HERE, 'schedule-tests', 'hooks.mjs')).href);
const L = await import('../app/components/board/boardLogic.js');

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// הקוד בלי הערות (ההערות מתעדות מה הוסר - לא קוד חי)
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ROUTE = read('../app/board/page.js');
const LAYOUT = read('../app/board/layout.js');
const SWITCH = read('../app/components/board/BoardSwitch.js');
const PAGE = read('../app/components/board/BoardPage.js');
const PARTS = read('../app/components/board/BoardParts.js');
const DAY = read('../app/components/board/BoardDayDialog.js');
const RENT = read('../app/components/board/BoardRentalModal.js');
const DLG = read('../app/components/board/BoardDialogs.js');
const GATE = read('../app/components/board/BoardGate.js');
const CARD = read('../app/components/gate/NoAccessCard.js');
const CSS = read('../app/components/board/board.css');
const HOOK = read('../components/orders/useRentalReturn.js');
const LEGACY = read('../components/orders/RentalReturnModal.js');
const PAGEGATE = read('../app/components/PageGate.js');
const API = read('../app/api/board/stages/route.js');
const RANGE = read('../lib/schedule/range.js');
const UI = code(PAGE + PARTS + DAY + RENT + DLG);
const ALL = UI + code(CARD + GATE);

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const has = (src, re, msg) => assert.ok(re.test(src), msg || String(re));
const hasNot = (src, re, msg) => assert.ok(!re.test(src), msg || 'נמצא: ' + re);

t('הנתיב /board טוען את הדף דרך dynamic; ה-CSS של הפלטה רק מתוך BoardPage', () => {
  has(ROUTE, /BoardSwitch/);
  has(SWITCH, /dynamic\(\(\) => import\('\.\/BoardPage'\), \{ ssr: false \}\)/);
  hasNot(ROUTE + SWITCH, /components\.css/);
  has(PAGE, /import '@\/design-system\/components\.css'/);
  has(PAGE, /import '@\/app\/schedule\/schedule\.css'/);
  has(PAGE, /import '\.\/board\.css'/);
});

t('E19: השער page:board נשאר (PageGate), רק החלון "אין הרשאה" בעיצוב החדש (בגרסה החדשה); PageGate בלי fallback לא השתנה', () => {
  has(LAYOUT, /<PageGate pageKey="page:board" fallback=\{<BoardGateSwitch legacy=\{<NoAccessMessage \/>\} next=\{<BoardGate \/>\} \/>\}>/);
  has(read('../app/components/board/BoardGateSwitch.js'), /useUiVariant\('board'\) === 'a5' \? next : legacy/);
  has(PAGEGATE, /return fallback \|\| <NoAccessMessage \/>/);
  has(GATE, /getSessionEmployee/);
  has(GATE, /<NoAccessCard guest=\{!employee\}/);
  has(CARD, /className="dlg dk gt-card"/, 'החלון הכהה של דף הכניסה (אחיד)');
  has(CARD, /אין הרשאת גישה/);
  has(CARD, /<LoginGate isModal/, 'אורח: כניסה למערכת בחלון הכניסה');
  has(API, /canOpenPage\('page:board'\)/, 'גם ה-API של המונים בשער page:board');
});

t('BD-O1: /board מאחורי המתג ישן/חדש - ברירת מחדל הלוח הישן (זהה ל-main, בייט-לבייט), החדש רק עם הדגל board=a5', () => {
  has(SWITCH, /useUiVariant\('board'\)/);
  has(SWITCH, /variant === 'a5' \? <BoardPage \/> : <LegacyBoardPage \/>/);
  has(SWITCH, /import\('@\/app\/board\/LegacyBoardPage'\)/);
  assert.ok(existsSync(new URL('../app/board/LegacyBoardPage.js', import.meta.url)));
  // הלוח הישן = הבלוב של app/board/page.js כפי שהיה לפני הלוח החדש (c944cb95, main) - בייט-לבייט
  const blob = execFileSync('git', ['show', 'c944cb95:app/board/page.js'], { cwd: path.resolve(HERE, '..'), maxBuffer: 1 << 26 });
  assert.ok(blob.equals(readFileSync(new URL('../app/board/LegacyBoardPage.js', import.meta.url))), 'LegacyBoardPage.js שונה מהבלוב ב-main');
  const uv = readFileSync(new URL('../lib/uiVariant.js', import.meta.url), 'utf8');
  has(uv, /'board'\]/); has(uv, /board: 'ui_variant_board'/);
});

t('E07/E02/E03/E04/E05/E06: אשף ההדפסה, חיפוש חכם, סטטיסטיקה, חיפוש גלובלי, חיפוש מתקדם ומקרא הסטטוס - הוסרו', () => {
  for (const re of [/PrintWizardModal/, /StatisticsModal/, /smart-search/, /\/api\/ai\//, /handleGlobalSearch|חיפוש גלובלי|חיפוש בכל החודשים/, /חיפוש מתקדם|advFilters|showAdvSearch|buildBoardAiPrompt/, /aiInputMode|isAiModeActive|חיפוש חכם/, /מקרא/, /HebrewDatePicker/]) hasNot(ALL, re);
  hasNot(ROUTE + LAYOUT, /PrintWizardModal|StatisticsModal/);
});

t('E09: בתא אין מונה הזמנות ואין הדפסת יום; JDG-3: אייקון "תצוגה מורחבת" רק מעל 2 הזמנות', () => {
  has(PARTS, /orders\.length > 2 \? \(\s*<button type="button" className="ibtn bd-ex"/);
  hasNot(PARTS, /i-printer|name="print"/, 'אין הדפסה בתא');
  hasNot(PARTS, /title="מספר הזמנות ליום זה"|cell-muted/);
  has(PARTS, /orders\.length > 0 && orders\.length <= 2/, 'עד 2 הזמנות - שורות קצרות בתא');
});

t('E11/JDG-6: אין תאריך לועזי בתאים, בכותרות ובחלונית הפרטים (עברית בלבד)', () => {
  hasNot(UI, /getDate\(\)\}\/\{|getMonth\(\) \+ 1\}|toLocaleDateString\('he-IL'\)|תאריך לועזי/);
  const g = L.buildMonthGrid(new Date(2026, 9, 4), new Date(2026, 9, 4));
  for (const c of g.flat().filter(Boolean)) {
    assert.ok(!/\d+\/\d+/.test(c.hebrewLong + c.letter + c.monthName + c.notes.join(' ')), 'תאריך לועזי בתא ' + c.key);
  }
});

t('E10: פרשה וחגים כטקסט פשוט, בלי תגית (badge/chip)', () => {
  has(PARTS, /<span className="bd-notes">\{cell\.notes\.join\(' · '\)\}<\/span>/);
  hasNot(PARTS, /badge-neutral/);
  const g = L.buildMonthGrid(new Date(2026, 9, 4), new Date(2026, 9, 4)).flat().filter(Boolean);
  const shabbat = g.find((c) => c.key === '2026-09-19');
  assert.deepEqual(shabbat.notes, ['הַאֲזִינוּ'], 'פרשה בשבת');
  assert.ok(g.find((c) => c.key === '2026-09-21').notes[0].includes('כִּפּוּר'), 'יום כיפור');
});

t('E01: חיפוש רגיל (מספר הזמנה / שם לקוח) עם ניקוי, בעיצוב חיפוש ההיסטוריה (hf-s, אייקון חיפוש); search נשלח לשרת', () => {
  has(PARTS, /className="hf-s" role="search"/);
  has(PARTS, /<Ic name="search" \/>/);
  has(PARTS, /placeholder="חיפוש הזמנה \(מספר הזמנה, שם לקוח\)\.\.\."/);
  has(PARTS, /className=\{'hf-cl' \+ \(value \? ' on' : ''\)\} aria-label="ניקוי חיפוש"/);
  has(PAGE, /const handleClearSearch = \(\) => \{ setSearchInput\(''\); setSearch\(''\); \};/);
  has(PAGE, /buildBoardMonthParams\(selectedDate, \{ search \}\)/);
});

t('S01: מסנן השלבים בשורת החיפוש בדיוק כמו בהיסטוריה (hf-sel/hf-t/hf-p/hf-o/hf-ck/hf-oi/hf-oc) + "הצג הכל"', () => {
  for (const cls of ['hf-sel', 'hf-t', 'hf-lbl', 'hf-bdg', 'hf-chv', 'hf-scrim', 'hf-p', 'hf-all', 'hf-allb', 'hf-l', 'hf-o', 'hf-ck', 'hf-oi', 'hf-ol', 'hf-oc', 'hf-pills', 'hf-pill']) has(PARTS, new RegExp(`className=[{"'][^>]*\\b${cls}\\b`), 'חסר ' + cls);
  has(PARTS, />הצג הכל</);
  has(PARTS, /<span className="hf-lbl">סינון<\/span>/);
  // ה-hf-sel יושב בתוך hf-s (כמו בכרטיס ההזמנה)
  assert.ok(PARTS.indexOf('className="hf-s"') < PARTS.indexOf("className={'hf-sel'"), 'hf-sel בתוך שורת החיפוש');
});

t('S04: "החודש הנוכחי" בגובה מתג התצוגה (28px), S03: מתג לוח/רשימה + רשימה אוטומטית בנייד', () => {
  has(PAGE, />החודש הנוכחי</);
  const vsw = /\.gm-ds \.vsw\{[^}]*height:(\d+)px/.exec(read('../design-system/components.css'));
  const btn = /\.gm-ds\.gm-bd #mToday\{[^}]*height:(\d+)px/.exec(CSS);
  assert.ok(vsw && btn, 'גבהים לא נמצאו');
  assert.equal(btn[1], vsw[1], 'גובה "החודש הנוכחי" שונה מגובה המתג');
  has(PAGE, /className=\{'vsw' \+ \(view === 'list' \? ' t' : ''\)\}/);
  has(PAGE, /MOBILE_MQ = '\(max-width:720px\)'/);
});

t('S12/S05/S08/S11: בלי תווית "תפעול", בלי "ללו״ז של היום", בלי ימי חודש סמוך, בלי שורות סיכום ברשימה', () => {
  hasNot(UI, /תפעול/);
  hasNot(UI, /ללו״ז של היום<|id="toDay"/);
  hasNot(PARTS, /\bdim\b/);
  hasNot(PARTS, /lz-lr|rlink/);
  has(PAGE, /<bdi>לוח חודשי<\/bdi>/, 'JDG-1: שם הדף "לוח חודשי"');
});

t('S06: לחיצה על יום = /schedule?date=<היום> רק כשההרשאה ללו״ז ידועה; לא ידוע / בלי הרשאה - חלון "הזמנות ליום" (ממצא 4)', () => {
  has(PAGE, /router\.push\('\/schedule\?date=' \+ cell\.key\)/);
  has(PAGE, /if \(!stagesData \|\| stagesData\.canOpenSchedule !== true\) \{/);
  has(API, /canOpenPage\('page:schedule'\)/);
});

t('נגישות (ממצא 3): הגריד הוא list/listitem (לא grid בלי שורות), הקישור הוא כותרת היום בלבד, אין role=link עם לחצנים בתוכו', () => {
  hasNot(code(PARTS), /role="grid"|role="link"/);
  has(PARTS, /className="hc-g lz-g" role="list"/);
  has(PARTS, /role="listitem"/);
  has(PARTS, /className="bd-dlink"\s+href=\{'\/schedule\?date=' \+ cell\.key\}/);
});

t('GAP-4: איחור החזרה = מסגרת אדומה לתא כולו (ולכותרת היום ברשימה) בנוסף לסימן האחד ולמסגרת השורה', () => {
  has(PARTS, /\(lateCount \? ' bd-latecell' : ''\)/);
  has(CSS, /\.gm-ds\.gm-bd \.hc-d\.lz-day\.bd-latecell\{box-shadow:inset 0 0 0 2px var\(--red\)\}/);
  has(CSS, /\.gm-ds\.gm-bd \.bd-or\.bd-late \.li\{box-shadow:inset 0 0 0 2px var\(--red\)\}/);
  has(CSS, /\.hday\.bd-hday\.bd-latecell/);
});

t('S09: חצי המקלדת מחליפים חודש (לא בתוך שדה ולא כשחלון פתוח)', () => {
  has(PAGE, /e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft'/);
  has(PAGE, /changeMonth\(e\.key === 'ArrowRight' \? -1 : 1\)/);
  has(PAGE, /if \(anyOverlay\) return;/);
});

t('S02/S10/E12: מונים באותו גוון חוץ מהתראה; סימן התראה אחד עם שתי סיבות (משימות + איחור החזרה)', () => {
  has(CSS, /\.gm-ds\.gm-bd \.lz-pr\{--pc:var\(--bd-pc\)/);
  has(CSS, /\.gm-ds\.gm-bd \.lz-pr\.al\{--pc:var\(--bd-pc-al\)\}/);
  hasNot(PARTS, /STAGE_META\[[^\]]+\]\.color/, 'צבע לכל שלב חזר');
  assert.deepEqual(L.cellAlert(2, 1), { count: 3, tip: '2 התראות בלו״ז · הזמנה אחת באיחור החזרה' });
  assert.ok(!/משימות שלא בוצעו/.test(code(read('../app/components/board/boardLogic.js'))), 'ניסוח "משימות" (כולל גם "חסרה כתובת") - צריך "התראות"');
  assert.equal(L.cellAlert(0, 0), null);
  has(PARTS, /className="tabmk debt lz-al"/);
});

t('E13/E14/E15: שורת הזמנה (שם · מספר · סטטוס · פס צבע), לחצן מידע עגול עם חלונית פרטים, תפריט כרטיס הזמנה / לקוח / השכרה', () => {
  has(PARTS, /className=\{'hrow irow lz-r bd-or'/);
  has(PARTS, /'--bd-cat': meta\.bar/);
  has(CSS, /\.gm-ds\.gm-bd \.ibtn\.bd-info\{[^}]*border-radius:50%/, 'לחצן המידע עגול');
  has(PARTS, /className="pl-rt on bd-rt"/);
  for (const k of ['טלפון', 'פריטים בהזמנה', 'הושכר', 'הוחזר', 'סה״כ לתשלום', 'שולם', 'סטטוס', 'ציפוף ימים']) assert.ok(PARTS.includes(`'${k}'`), 'חסר ' + k);
  has(PARTS, /!hideCustomSpacing && o\.customSpacing !== null/);
  has(PARTS, />כרטיס הזמנה</); has(PARTS, />כרטיס לקוח</); has(PARTS, />כרטיס השכרה</);
  has(PARTS, /custId \? <button/, 'כרטיס לקוח רק עם מזהה לקוח');
  has(PAGE, /router\.push\(`\/orders\/\$\{o\.orderId\}`\)/);
  has(PAGE, /router\.push\(`\/customers\/\$\{id\}`\)/);
});

t('E17: חלון "הזמנות ליום" כמו הלו״ז (ציר st-sidenav + שורות lz-r) עם סינון שם/טלפון/מספר; הדפסת יום רק עם enable_batch_print_prep', () => {
  has(DAY, /className="st-sidenav lz-snav"/);
  has(DAY, /className="card lz-st bd-dst"/);
  has(DAY, /placeholder="חיפוש הזמנה ביום זה \(שם, טלפון, מספר\)\.\.\."/);
  has(DAY, /enableBatchPrintPrep && orders\.length \?/);
  has(PAGE, /window\.open\(`\/print\/order\?orderId=\$\{ids\}&type=order&batch=1`, '_blank'\)/);
  assert.equal(L.filterDayOrders([{ orderId: 5, customerName: 'שרה', customerPhone: '052' }, { orderId: 6, customerName: 'לאה' }], '05').length, 1);
});

t('E16/UNV-6: חלון ההשכרה בעיצוב חדש עם כל הפונקציונליות - אותו hook כמו החלון הקיים, אותן קריאות API', () => {
  has(RENT, /useRentalReturn\(\{ orderId, onClose, onUpdate, ui \}\)/);
  has(LEGACY, /useRentalReturn\(\{ orderId, onClose, onUpdate, ui: LEGACY_UI \}\)/);
  for (const api of ['/api/rentals/scan', '/api/rentals/confirm', '/api/rentals/cancel', '/api/rentals/toggle', '/api/returns/scan', '/api/returns/report-issue', '/api/audit/order-item/', '/api/customers/', '/api/orders/']) assert.ok(HOOK.includes(api), 'חסר ' + api);
  for (const fn of ['handleGlobalBarcodeScan', 'confirmInlineRent', 'confirmManualEntry', 'cancelManualEntry', 'selectDuplicate', 'confirmRental', 'handleMarkReturnGood', 'handleMarkReturnBad', 'undoRental', 'undoReturn', 'reportIssue', 'markReturnGoodAgain', 'showItemDetails', 'handleHeaderSave', 'handleHeaderCancel', 'attemptCloseCard', 'handlePrintPreConfirm']) assert.ok(new RegExp('\\b' + fn + '\\b').test(RENT), 'החלון החדש לא משתמש ב-' + fn);
  has(RENT, /<OrderPrintMenu/);
  has(PAGE, /onUpdate=\{fetchOrdersForMonth\}/, 'אחרי עדכון בחלון - רק ההזמנות נטענות מחדש (ממצא 2)');
  has(PAGE, /onClose=\{\(\) => \{ setRentalId\(null\); fetchStages\(\{ fresh: true \}\); \}\}/, 'המונים - כשהחלון נסגר');
  hasNot(code(HOOK), /window\.(alert|confirm|customConfirm|customPrompt)\(|[^.\w]alert\(/, 'ה-hook לא קורא ישירות לחלונות הדפדפן');
});

t('אין window.alert / window.confirm / prompt של הדפדפן ואין title= (טולטיפ דפדפן) בקוד הלוח', () => {
  hasNot(UI + code(CARD), /window\.(alert|confirm|prompt)\(|[^.\w](alert|confirm|prompt)\(/, 'alert/confirm');
  hasNot(UI + code(CARD), /customConfirm|customPrompt/);
  hasNot(UI + CARD, /\btitle=/);
  hasNot(UI, /console\.(log|info|debug)/);
});

t('E21/E18: טעינה כמו קודם - חודש עברי ±14 יום, מטמון SWR, ביטול בקשה קודמת, "טוען נתונים..."', () => {
  has(PAGE, /cacheNamespace\('board'\)/);
  has(PAGE, /boardCache\.has\(cacheKey\)/);
  has(PAGE, /activeOrdersRequestRef\.current\.abort\(\)/);
  has(PAGE, /if \(err\.name === 'AbortError'\) return;/);
  has(PAGE, /fetch\(`\/api\/orders\?\$\{queryParams\.toString\(\)\}`, \{ signal: controller\.signal \}\)/);
  has(PAGE, /useState\(true\)/);
  has(PAGE, /טוען נתונים\.\.\./);
  has(PAGE, /className="mspin"/);
  const pf = read('../app/lib/prefetchRoutes.js');
  has(pf, /eventDateFrom: fromDate\.toISOString\(\)/);
  has(pf, /fromDate\.setDate\(fromDate\.getDate\(\) - 14\)/);
});

t('E20: ההגדרות enable_alterations / hide_custom_spacing / enable_batch_print_prep נקראות כמו קודם', () => {
  has(PAGE, /fetchSharedJson\('\/api\/settings', \{ ttl: TTL\.STATIC \}\)/);
  for (const k of ['enable_alterations', 'hide_custom_spacing', 'enable_batch_print_prep']) assert.ok(PAGE.includes(k), k);
  assert.equal(L.orderCategory({ items: [{ neckAlteration: 1 }], totalAmount: 100, totalPaid: 0 }, true), 'repairs');
  assert.equal(L.orderCategory({ items: [{ neckAlteration: 1 }], totalAmount: 100, totalPaid: 0 }, false), 'unpaid');
});

t('לוגיקה: קטגוריות הסטטוס כמו בדף הקודם; איחור החזרה = הכלל של הלו״ז (סף מההגדרות + ימי עסקים)', () => {
  assert.equal(L.orderCategory({ items: [] }), 'empty');
  assert.equal(L.orderCategory({ items: [{ isTaken: true, isReturned: true }] }), 'returned');
  assert.equal(L.orderCategory({ items: [{ isTaken: true }, {}] }), 'rented');
  assert.equal(L.orderCategory({ items: [{}], totalAmount: 100, totalPaid: 100 }), 'completed');
  assert.equal(L.orderCategory({ items: [{}], totalAmount: 0, totalPaid: 0 }), 'other');
  // E12 = כלל הלו״ז: late_return_threshold_days (ברירת מחדל 7) ממועד ההחזרה הצפוי (יום העבודה הראשון אחרי האירוע,
  // או toDate/returnDate מגולגל), רק כשיש פריט שנלקח ולא הוחזר (דגל או תאריך)
  const ev = (y, m, d) => new Date(Date.UTC(y, m - 1, d - 1, 21)).toISOString(); // חצות ישראל
  const taken = [{ isTaken: true }];
  const now = new Date(Date.UTC(2026, 9, 20, 9)); // ג׳ 20.10.2026
  // אירוע ב׳ 12.10 -> החזרה צפויה ג׳ 13.10 -> 7 ימים ב-20.10 = באיחור; הכלל הישן (2 ימים) היה מסמן כבר ב-15.10
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 12), items: taken }, { now }), true);
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 14), items: taken }, { now }), false, '5 ימים - לא באיחור (סף 7)');
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 14), items: taken }, { now, threshold: 3 }), true, 'הסף מההגדרות');
  // אירוע ה׳ 15.10 -> החזרה ראשון 18.10 (שישי/שבת מדולגים) -> 2 ימים
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 15), items: taken }, { now, threshold: 3 }), false, 'ימי עסקים: אירוע בחמישי -> החזרה בראשון');
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 1), items: [{ isTaken: true, isReturned: true }] }, { now }), false);
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 1), items: [{ isTaken: true, isDeleted: true }] }, { now }), false);
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 1), items: [{ takenDate: ev(2026, 9, 29) }] }, { now }), true, 'נלקח לפי תאריך (כמו הלו״ז)');
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 1), items: [{}] }, { now }), false, 'לא נלקח - לא איחור החזרה');
  // toDate מפורש (חו״ל) גובר על האירוע
  assert.equal(L.isOrderLate({ eventDate: ev(2026, 10, 1), toDate: ev(2026, 10, 19), isAbroad: true, items: taken }, { now }), false);
});

t('לוגיקה: ניווט חודשים, 13 חודשי הקפיצה, טווח המונים והגריד העברי', () => {
  const d = new Date(2026, 9, 4); // כ״ג תשרי תשפ״ז
  assert.equal(L.monthTitle(d), 'תשרי תשפ"ז');
  assert.equal(L.monthTitle(L.shiftMonth(d, 1)), 'חשוון תשפ"ז');
  assert.equal(L.monthTitle(L.shiftMonth(d, -1)), 'אלול תשפ"ו');
  const j = L.jumpMonths(d);
  assert.equal(j.length, 13);
  assert.equal(j[6].title, 'תשרי תשפ"ז');
  assert.deepEqual(L.monthRangeKeys(d), { from: '2026-09-12', to: '2026-10-11' });
  const g = L.buildMonthGrid(d, d);
  const cells = g.flat().filter(Boolean);
  assert.equal(cells.length, 30);
  assert.equal(g.flat().indexOf(cells[0]), 6, 'א׳ תשרי תשפ״ז בשבת');
  assert.equal(cells.find((c) => c.isToday).letter, 'כ״ג');
  assert.equal(cells[0].monthName, 'תשרי');
  assert.ok(g.every((w) => w.length === 7));
  assert.equal(L.stageCountText({ label: 'הכנה', plural: 'הכנות' }, 1), 'הכנה אחת');
  assert.equal(L.stageCountText({ label: 'הכנה', plural: 'הכנות' }, 3), '3 הכנות');
});

t('API חדש GET /api/board/stages: מספרים בלבד, אותו חישוב כמו הלו״ז (getScheduleDay), טווח עד 31 יום', () => {
  has(RANGE, /import \{ getScheduleDay \} from '\.\/index'/);
  has(RANGE, /MAX_RANGE_DAYS = 31/);
  has(RANGE, /RANGE_CONCURRENCY = [23];/, '2-3 ימים במקביל');
  has(API, /maxDuration = 60/);
  has(API, /createRangeCache/, 'מטמון קצר בשרת');
  has(API, /rangeCacheKey\(\{ dbTag: dbTag\(\), host: request\.headers\.get\('host'\) \|\| '', from, to, branch \}\)/, 'מפתח המטמון כולל DB, מארח, טווח וסניף');
  has(PAGE, /setTimeout\(\(\) => fetchStages\(\), STAGES_DEBOUNCE_MS\)/, 'בקשת המונים במעבר חודש - אחרי השהיה');
  has(PAGE, /STAGES_DEBOUNCE_MS = 300/);
  has(RANGE, /user: null/);
  has(RANGE, /skipStaff: true/);
  hasNot(RANGE + API + read('../lib/schedule/rangeCache.js'), /prisma\.\w+\.(create|update|upsert|delete)|\$executeRaw/, 'אין כתיבה');
  has(API, /checkAuth\(\)/);
  const days = { a: { s: { prep: { t: 2, a: 1 }, event: { t: 1, a: 0 } } } };
  const stages = [{ key: 'prep', enabled: true }, { key: 'event', enabled: true }, { key: 'dout', enabled: false }];
  assert.deepEqual(L.dayStageRows(days.a, stages, []).map((r) => r.stage.key), ['prep', 'event']);
  assert.deepEqual(L.dayStageRows(days.a, stages, ['event']).map((r) => r.stage.key), ['event']);
  assert.deepEqual(L.monthStageTotals(days, stages), { prep: 2, event: 1, dout: 0 });
});

t('board.css: כל כלל בהיקף .gm-ds.gm-bd (חוץ מביטול ריפוד המעטפת), והשורש בלי gm-home', () => {
  has(PAGE, /className="gm-ds gm-lz gm-bd home-bg dlg-dark"/);
  hasNot(PAGE, /gm-home/);
  assert.ok(existsSync(new URL('../app/components/board/board.css', import.meta.url)));
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
