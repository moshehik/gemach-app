// בדיקת חוזה לדף "לוח חודשי" (/board) אחרי המעבר לעיצוב החדש (תשובות הבעלים 4.10.2026, scratch/board-build/answers-board.json):
// BD-O3 (5.10.2026): חלון "הזמנות ליום" נמחק - כל לחיצה על יום עוברת לדף הלו״ז. F13: שחרור קודם למתכנת בלבד (הרישום).
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
const GATE = read('../app/components/board/BoardGate.js');
const CARD = read('../app/components/gate/NoAccessCard.js');
const CSS = read('../app/components/board/board.css');
const HOOK = read('../components/orders/useRentalReturn.js');
const LEGACY = read('../components/orders/RentalReturnModal.js');
const PAGEGATE = read('../app/components/PageGate.js');
const API = read('../app/api/board/stages/route.js');
const RANGE = read('../lib/schedule/range.js');
const UI = code(PAGE + PARTS);
const ALL = UI + code(CARD + GATE);

let passed = 0;
let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const has = (src, re, msg) => assert.ok(re.test(src), msg || String(re));
const hasNot = (src, re, msg) => assert.ok(!re.test(src), msg || 'נמצא: ' + re);

await t('הנתיב /board טוען את הדף דרך dynamic; ה-CSS של הפלטה רק מתוך BoardPage', () => {
  has(ROUTE, /BoardSwitch/);
  has(SWITCH, /dynamic\(\(\) => import\('\.\/BoardPage'\), \{ ssr: false \}\)/);
  hasNot(ROUTE + SWITCH, /components\.css/);
  has(PAGE, /import '@\/design-system\/components\.css'/);
  has(PAGE, /import '@\/app\/schedule\/schedule\.css'/);
  has(PAGE, /import '\.\/board\.css'/);
});

await t('E19: השער page:board נשאר (PageGate), רק החלון "אין הרשאה" בעיצוב החדש (בגרסה החדשה); PageGate בלי fallback לא השתנה', () => {
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

await t('BD-O1 / F13: /board מאחורי המתג ישן/חדש לפי הרישום המרכזי - ברירת מחדל הלוח הישן, החדש למתכנת בלבד; הישן זהה ל-main בייט-לבייט', async () => {
  const c = code(ROUTE);
  has(c, /const variant = await getRequestUiVariant\('board'\);/);
  has(c, /<VariantFrame screen="board" variant=\{variant\}>/);
  has(c, /variant === 'legacy' \? <LegacyBoardPage \/> : <BoardSwitch \/>/);
  has(c, /import LegacyBoardPage from '\.\/LegacyBoardPage'/);
  hasNot(code(SWITCH), /useUiVariant|LegacyBoardPage/, 'הבחירה בשרת, לא בלקוח');
  assert.ok(existsSync(new URL('../app/board/LegacyBoardPage.js', import.meta.url)));
  // הרישום (lib/uiVariantScreens.js): board = {routes:['/board'], legacyExists, newExists, selfSwitch}; ברירת מחדל: מתכנת a5, אחרים legacy
  const R = await import('../lib/uiVariantScreens.js');
  const e = R.getScreenEntry('board');
  assert.ok(e && e.legacyExists === true && e.newExists === true && e.selfSwitch === true && e.switchTargets === null);
  assert.deepEqual([...e.routes], ['/board']);
  assert.equal(R.roleDefaultVariant('board', 2), 'a5', 'מתכנת - הלוח החדש');
  for (const r of [0, 1, 3, 4, 5, null, undefined]) assert.equal(R.roleDefaultVariant('board', r), 'legacy', 'תפקיד ' + r);
  assert.ok(!R.NO_LEGACY_PAGES.some((x) => x.routes.includes('/board')), 'הלוח לא ברשימת הדפים בלי גרסה ישנה');
  has(PAGE, /<PageVariantToggle screen="board" placement="header" systemTip \/>/, 'מתג חזרה לישן בכותרת הלוח החדש');
  has(LAYOUT, /BoardGateSwitch legacy=\{<NoAccessMessage \/>\} next=\{<BoardGate \/>\}/);
  // הלוח הישן = הבלוב של app/board/page.js כפי שהיה לפני הלוח החדש (c944cb95, main) - בייט-לבייט
  const blob = execFileSync('git', ['show', 'c944cb95:app/board/page.js'], { cwd: path.resolve(HERE, '..'), maxBuffer: 1 << 26 });
  assert.ok(blob.equals(readFileSync(new URL('../app/board/LegacyBoardPage.js', import.meta.url))), 'LegacyBoardPage.js שונה מהבלוב ב-main');
});

await t('E07/E02/E03/E04/E05/E06: אשף ההדפסה, חיפוש חכם, סטטיסטיקה, חיפוש גלובלי, חיפוש מתקדם ומקרא הסטטוס - הוסרו', () => {
  for (const re of [/PrintWizardModal/, /StatisticsModal/, /smart-search/, /\/api\/ai\//, /handleGlobalSearch|חיפוש גלובלי|חיפוש בכל החודשים/, /חיפוש מתקדם|advFilters|showAdvSearch|buildBoardAiPrompt/, /aiInputMode|isAiModeActive|חיפוש חכם/, /מקרא/, /HebrewDatePicker/]) hasNot(ALL, re);
  hasNot(ROUTE + LAYOUT, /PrintWizardModal|StatisticsModal/);
});

await t('BD-O4 / BD-O5 / E09: בתא וברשימה רק סמנים ומונים - בלי שורות הזמנה, בלי אייקון "מורחב", בלי מונה הזמנות / הדפסה', () => {
  const cell = PARTS.slice(PARTS.indexOf('export function DayCell'), PARTS.indexOf('export function MonthGrid'));
  const list = PARTS.slice(PARTS.indexOf('export function DayList'), PARTS.indexOf('export { WEEKDAYS }'));
  for (const part of [cell, list]) {
    hasNot(code(part), /OrderRow|CellOrder|bd-co\b|bd-cos|bd-ex|onExpand|onOrder|onHint|enableAlterations|customerName|#\{order|orderId|setDayDlg|BoardDayDialog/, 'פירוט הזמנות בתא / ברשימה');
    hasNot(code(part), /i-printer|name="print"|name="eye"/);
    has(part, /<StageCounters rows=\{rows\}/, 'מוני השלבים');
  }
  has(cell, /lateCount \? ' bd-latecell' : ''/, 'מסגרת איחור החזרה נשארת סמן');
  has(cell, /className="tabmk debt lz-al"/, 'סימן ההתראה נשאר');
  has(PARTS, /'lz-pr' \+ \(r\.alerts \? ' al' : ''\)/, 'גוון ההתראה על מונה');
  has(list, /filter\(\(d\) => d\.rows\.length \|\| d\.alert\)/, 'ברשימה: ימים עם מונים או התראה (לא "ימים עם הזמנות")');
  has(list, /<StageCounters rows=\{rows\} className="bd-lc" \/>/, 'ברשימה: מונים מתחת לכותרת היום');
  // המסך נשאר ללא הסרות שגויות: הקוד הישן של השורה והאייקון לא קיים בשום קובץ של הלוח
  hasNot(CSS, /bd-co\b|bd-cos|bd-ex\b|--bd-cat/);
});

await t('BD-O7: אין תגית סטטוס ושורת סטטוס בלוח, ובלוגיקה אין עוד קטגוריית סטטוס', () => {
  hasNot(code(PARTS), /CATEGORY|orderCategory|categoryOrder|'סטטוס'|meta\.chip|meta\.label/);
  assert.equal(L.orderCategory, undefined);
  assert.equal(L.CATEGORY, undefined);
});

await t('E11/JDG-6: אין תאריך לועזי בתאים, בכותרות ובחלונית הפרטים (עברית בלבד)', () => {
  hasNot(UI, /getDate\(\)\}\/\{|getMonth\(\) \+ 1\}|toLocaleDateString\('he-IL'\)|תאריך לועזי/);
  const g = L.buildMonthGrid(new Date(2026, 9, 4), new Date(2026, 9, 4));
  for (const c of g.flat().filter(Boolean)) {
    assert.ok(!/\d+\/\d+/.test(c.hebrewLong + c.letter + c.monthName + c.notes.join(' ')), 'תאריך לועזי בתא ' + c.key);
  }
});

await t('E10: פרשה וחגים כטקסט פשוט, בלי תגית (badge/chip)', () => {
  has(PARTS, /<span className="bd-notes">\{cell\.notes\.join\(' · '\)\}<\/span>/);
  hasNot(PARTS, /badge-neutral/);
  const g = L.buildMonthGrid(new Date(2026, 9, 4), new Date(2026, 9, 4)).flat().filter(Boolean);
  const shabbat = g.find((c) => c.key === '2026-09-19');
  assert.deepEqual(shabbat.notes, ['הַאֲזִינוּ'], 'פרשה בשבת');
  assert.ok(g.find((c) => c.key === '2026-09-21').notes[0].includes('כִּפּוּר'), 'יום כיפור');
});

await t('E01: חיפוש רגיל (מספר הזמנה / שם לקוח) עם ניקוי, בעיצוב חיפוש ההיסטוריה (hf-s, אייקון חיפוש); search נשלח לשרת', () => {
  has(PARTS, /className="hf-s" role="search"/);
  has(PARTS, /<Ic name="search" \/>/);
  has(PARTS, /placeholder="חיפוש הזמנה \(מספר הזמנה, שם לקוח\)\.\.\."/);
  has(PARTS, /className=\{'hf-cl' \+ \(value \? ' on' : ''\)\} aria-label="ניקוי חיפוש"/);
  has(PAGE, /const handleClearSearch = \(\) => \{ setSearchInput\(''\); setSearch\(''\); \};/);
  has(PAGE, /buildBoardMonthParams\(selectedDate, \{ search \}\)/);
});

await t('S01: מסנן השלבים בשורת החיפוש בדיוק כמו בהיסטוריה (hf-sel/hf-t/hf-p/hf-o/hf-ck/hf-oi/hf-oc) + "הצג הכל"', () => {
  for (const cls of ['hf-sel', 'hf-t', 'hf-lbl', 'hf-bdg', 'hf-chv', 'hf-scrim', 'hf-p', 'hf-all', 'hf-allb', 'hf-l', 'hf-o', 'hf-ck', 'hf-oi', 'hf-ol', 'hf-oc', 'hf-pills', 'hf-pill']) has(PARTS, new RegExp(`className=[{"'][^>]*\\b${cls}\\b`), 'חסר ' + cls);
  has(PARTS, />הצג הכל</);
  has(PARTS, /<span className="hf-lbl">סינון<\/span>/);
  // ה-hf-sel יושב בתוך hf-s (כמו בכרטיס ההזמנה)
  assert.ok(PARTS.indexOf('className="hf-s"') < PARTS.indexOf("className={'hf-sel'"), 'hf-sel בתוך שורת החיפוש');
});

await t('S04: "החודש הנוכחי" בגובה מתג התצוגה (28px), S03: מתג לוח/רשימה + רשימה אוטומטית בנייד', () => {
  has(PAGE, />החודש הנוכחי</);
  const vsw = /\.gm-ds \.vsw\{[^}]*height:(\d+)px/.exec(read('../design-system/components.css'));
  const btn = /\.gm-ds\.gm-bd #mToday\{[^}]*height:(\d+)px/.exec(CSS);
  assert.ok(vsw && btn, 'גבהים לא נמצאו');
  assert.equal(btn[1], vsw[1], 'גובה "החודש הנוכחי" שונה מגובה המתג');
  has(PAGE, /className=\{'vsw' \+ \(view === 'list' \? ' t' : ''\)\}/);
  has(PAGE, /MOBILE_MQ = '\(max-width:720px\)'/);
});

await t('S12/S05/S08/S11: בלי תווית "תפעול", בלי "ללו״ז של היום", בלי ימי חודש סמוך, בלי שורות סיכום ברשימה', () => {
  hasNot(UI, /תפעול/);
  hasNot(UI, /ללו״ז של היום<|id="toDay"/);
  hasNot(PARTS, /\bdim\b/);
  hasNot(PARTS, /lz-lr|rlink/);
  has(PAGE, /<bdi>לוח חודשי<\/bdi>/, 'JDG-1: שם הדף "לוח חודשי"');
});

await t('S06 / BD-O3: כל לחיצה על יום = /schedule?date=<היום>, תמיד - בלי חלון ובלי חלופה לפי הרשאה', () => {
  has(PAGE, /const openDay = useCallback\(\(cell\) => \{ router\.push\('\/schedule\?date=' \+ cell\.key\); \}, \[router\]\);/);
  hasNot(code(PAGE + PARTS), /canOpenSchedule|dayDlg|setDayDlg|BoardDayDialog|stagesData\.can/, 'אין עוד תנאי הרשאה / חלון יום');
  hasNot(code(API), /canOpenSchedule|page:schedule/, 'ה-API לא בודק page:schedule (דף הלו״ז מציג בעצמו "אין הרשאה")');
  has(read('../app/schedule/layout.js'), /<PageGate pageKey="page:schedule">/, 'דף הלו״ז בשער page:schedule עם חלון "אין הרשאה" משלו');
});

await t('נגישות (BD-O3): הגריד list/listitem; כל יום (בתא וברשימה) הוא קישור אמיתי <a href> - Enter עובד, Ctrl/אמצעי פותחים טאב; אין role=link עם לחצנים בתוכו', () => {
  hasNot(code(PARTS), /role="grid"|role="link"/);
  has(PARTS, /className="hc-g lz-g" role="list"/);
  has(PARTS, /role="listitem"/);
  has(PARTS, /className="bd-dlink"\s+href=\{href\}/);
  has(PARTS, /const href = '\/schedule\?date=' \+ cell\.key;/);
  has(PARTS, /<a className=\{'hday bd-hday' \+ \(late \? ' bd-latecell' : ''\)\} href=\{'\/schedule\?date=' \+ cell\.key\} onClick=\{\(e\) => goTo\(e, cell, onOpenDay\)\}/, 'ברשימה: קישור ולא לחצן');
  hasNot(code(PARTS), /<button type="button" className=\{'hday/, 'כותרת היום ברשימה כבר לא לחצן');
  has(PARTS, /e\.button > 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/, 'Ctrl/Shift/אמצעי = התנהגות קישור רגילה');
});

await t('GAP-4: איחור החזרה = מסגרת אדומה לתא כולו (ולכותרת היום ברשימה) בנוסף לסימן האחד ולמסגרת השורה', () => {
  has(PARTS, /\(lateCount \? ' bd-latecell' : ''\)/);
  has(CSS, /\.gm-ds\.gm-bd \.hc-d\.lz-day\.bd-latecell\{box-shadow:inset 0 0 0 2px var\(--red\)\}/);
  has(CSS, /\.hday\.bd-hday\.bd-latecell/);
});

await t('S09: חצי המקלדת מחליפים חודש (לא בתוך שדה)', () => {
  has(PAGE, /e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft'/);
  has(PAGE, /changeMonth\(e\.key === 'ArrowRight' \? -1 : 1\)/);
  hasNot(code(PAGE), /anyOverlay/, 'אין חלונות בלוח');
});

await t('S02/S10/E12: מונים באותו גוון חוץ מהתראה; סימן התראה אחד עם שתי סיבות (משימות + איחור החזרה)', () => {
  has(CSS, /\.gm-ds\.gm-bd \.lz-pr\{--pc:var\(--bd-pc\)/);
  has(CSS, /\.gm-ds\.gm-bd \.lz-pr\.al\{--pc:var\(--bd-pc-al\)\}/);
  hasNot(PARTS, /STAGE_META\[[^\]]+\]\.color/, 'צבע לכל שלב חזר');
  assert.deepEqual(L.cellAlert(2, 1), { count: 3, tip: '2 התראות בלו״ז · הזמנה אחת באיחור החזרה' });
  assert.ok(!/משימות שלא בוצעו/.test(code(read('../app/components/board/boardLogic.js'))), 'ניסוח "משימות" (כולל גם "חסרה כתובת") - צריך "התראות"');
  assert.equal(L.cellAlert(0, 0), null);
  has(PARTS, /className="tabmk debt lz-al"/);
});

await t('BD-O3: חלון "הזמנות ליום" נמחק לגמרי - הקבצים, תפריט ההזמנה, חלונית הפרטים, חלון ההשכרה והסטייל שלהם; הרכיבים המשותפים נשארו', () => {
  for (const f of ['BoardDayDialog.js', 'BoardRentalModal.js', 'BoardDialogs.js']) assert.ok(!existsSync(new URL('../app/components/board/' + f, import.meta.url)), f + ' עדיין קיים');
  const bad = /BoardDayDialog|BoardRentalModal|BoardDialogs|useBoardDialogs|OrderRow|ActionMenu|InfoHint|filterDayOrders|MarkToast|LzPortal|hideCustomSpacing|setRentalId|rentalUi|dialogs\./;
  hasNot(code(PAGE + PARTS + SWITCH), bad);
  assert.equal(L.filterDayOrders, undefined);
  assert.equal(L.customerName, undefined);
  hasNot(CSS, /bd-day|bd-dl\b|bd-dh\b|bd-rent|bd-menu|bd-rt\b|bd-info|bd-or\b|bd-cf|bd-scrim|bd-item|bd-dup|#toast/, 'סטייל של החלונות נשאר');
  // הרכיבים המשותפים שחלון ההשכרה של הלוח הסתמך עליהם - נשארים (משמשים את /orders, /rentals)
  assert.ok(existsSync(new URL('../components/orders/useRentalReturn.js', import.meta.url)));
  has(LEGACY, /useRentalReturn\(\{ orderId, onClose, onUpdate, ui: LEGACY_UI \}\)/);
  assert.ok(existsSync(new URL('../app/components/gate/NoAccessCard.js', import.meta.url)));
  assert.ok(existsSync(new URL('../app/components/schedule/MarkDialogs.js', import.meta.url)), 'שימוש משותף בלו״ז');
});

await t('אין window.alert / window.confirm / prompt של הדפדפן ואין title= (טולטיפ דפדפן) בקוד הלוח', () => {
  hasNot(UI + code(CARD), /window\.(alert|confirm|prompt)\(|[^.\w](alert|confirm|prompt)\(/, 'alert/confirm');
  hasNot(UI + code(CARD), /customConfirm|customPrompt/);
  hasNot(UI + CARD, /\btitle=/);
  hasNot(UI, /console\.(log|info|debug)/);
});

await t('E21/E18: טעינה כמו קודם - חודש עברי ±14 יום, מטמון SWR, ביטול בקשה קודמת, "טוען נתונים..."', () => {
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

await t('E20: רק כלל איחור ההחזרה נקרא מההגדרות; hide_custom_spacing (חלונית הפרטים), enable_alterations, enable_batch_print_prep כבר לא (BD-O3 / BD-O6 / BD-O7)', () => {
  has(PAGE, /fetchSharedJson\('\/api\/settings', \{ ttl: TTL\.STATIC \}\)/);
  for (const k of ['late_return_threshold_days', 'NON_WORKING_DAYS_SETTING_KEY']) assert.ok(PAGE.includes(k), k);
  hasNot(code(PAGE), /enable_alterations|enable_batch_print_prep|setEnableAlterations|setEnableBatchPrintPrep|hide_custom_spacing/);
});

await t('לוגיקה: איחור החזרה = הכלל של הלו״ז (סף מההגדרות + ימי עסקים)', () => {
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

await t('לוגיקה: ניווט חודשים, 13 חודשי הקפיצה, טווח המונים והגריד העברי', () => {
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

await t('API חדש GET /api/board/stages: מספרים בלבד, אותו חישוב כמו הלו״ז (getScheduleDay), טווח עד 31 יום', () => {
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

await t('board.css: כל כלל בהיקף .gm-ds.gm-bd (חוץ מביטול ריפוד המעטפת), והשורש בלי gm-home', () => {
  has(PAGE, /className="gm-ds gm-lz gm-bd home-bg dlg-dark"/);
  hasNot(PAGE, /gm-home/);
  assert.ok(existsSync(new URL('../app/components/board/board.css', import.meta.url)));
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
