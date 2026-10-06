// בדיקות הקידומות '#' (פעולות מהירות) ו-'$' (חיפושים שמורים) ומדריך הקיצורים: lib/quickShortcuts.js + lib/quickPrefix.js + /?run= ב-homeLogic.
// טהור: בלי DB, DOM או רשת. החיווט (הרכיבים) נבדק סטטית בסוף הקובץ. עיצוב: תצוגות-עיצוב/חיפוש-קיצורים.html (החלטות PFX-01..11).
// הרצה: node scripts/test_quick_prefix_shortcuts.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUICK_PREFIXES, detectQuickPrefix, resolveQuickPrefix } from '../lib/quickPrefix.js';
import {
  SAVED_SEARCH_LIMIT, SAVED_LABEL_MAX, SAVED_QUERY_MAX, SHORTCUT_GUIDE, guideRows, QUICK_ACTIONS, actionTarget, draftTail, buildActionsModel, buildKeywordsModel, keywordInsert, KEYWORDS_TEXT,
  menuAllowedPaths, saveCandidate, defaultSaveLabel, isQuerySaved, buildSavedModel, savePayload, SAVED_TEXT, ACTIONS_TEXT,
} from '../lib/quickShortcuts.js';
import { KEYWORD_GUIDE, classifyQuery, parseKeywords } from '../lib/searchNormalize.js';
import { buildMenuTree, flattenMenuTree, NAV_PAGE_KEYS } from '../lib/menu/buildMenuTree.js';
import { parseHomeParams, homeDirectiveKey, HOME_RUN_VALUES } from '../app/components/home/homeLogic.js';
import { buildAdvRequest, emptyAdv, advSummaryParts, unsavedOrderIds } from '../app/components/home/homeAdvConfig.js';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log("קידומות: '#' ו-'$' ברישום");
t("QUICK_PREFIXES: '@' '&' '#' '$' '%' - כל אחת עם source משלה; כתו ראשון בלבד", () => {
  assert.deepEqual(Object.keys(QUICK_PREFIXES), ['@', '&', '#', '$', '%']);
  assert.equal(QUICK_PREFIXES['%'].source, 'keywords'); assert.equal(QUICK_PREFIXES['%'].id, 'keywords'); assert.equal(detectQuickPrefix('%מידה').term, 'מידה'); assert.equal(detectQuickPrefix('100%'), null, "'%' באמצע לא קידומת");
  assert.equal(QUICK_PREFIXES['#'].source, 'actions'); assert.equal(QUICK_PREFIXES['$'].source, 'saved');
  assert.equal(detectQuickPrefix('#').prefix, '#'); assert.equal(detectQuickPrefix('# טיוט ').term, 'טיוט');
  assert.equal(detectQuickPrefix('$כהן').def.id, 'saved');
  for (const no of [' #', 'a#b', 'כהן$', '1#', '#'.slice(1), 'Q$A']) assert.equal(detectQuickPrefix(no), null, no);
});
t("resolveQuickPrefix: '#' / '$' כבויות כשאין לקורא מקור (actionsUsable / savedUsable=false) או שהמקום לא מפעיל אותן", () => {
  assert.equal(resolveQuickPrefix('#x').prefix, '#'); assert.equal(resolveQuickPrefix('$x').prefix, '$');
  assert.equal(resolveQuickPrefix('#x', { actionsUsable: false }), null);
  assert.equal(resolveQuickPrefix('$x', { savedUsable: false }), null);
  assert.equal(resolveQuickPrefix('$x', { actionsUsable: false }).prefix, '$', 'כל מקור עצמאי');
  assert.equal(resolveQuickPrefix('#x', { prefixes: ['&'] }), null, "בחיפוש שמפעיל רק '&'");
  assert.equal(resolveQuickPrefix('#x', { prefixes: ['&', '#', '$'] }).prefix, '#');
  assert.equal(resolveQuickPrefix('#x', { enabled: false }), null);
  assert.equal(resolveQuickPrefix(' #x'), null, 'שורה לא מקוצצת');
});

console.log("'#' - פעולות מהירות (PFX-01: לפי הרשאות, PFX-02: כל החובות, PFX-03: טיוטות מהעמדה הזו)");
const HEAD = new Set(['/orders/new', '/orders', '/customers']);
const WORKER = new Set(['/orders', '/customers']);
t('שלוש פעולות בסדר: הזמנה חדשה, טיוטות, ממתינים לתשלום; הרשאה = נתיב התפריט', () => {
  assert.deepEqual(QUICK_ACTIONS.map((a) => a.title), ['הזמנה חדשה', 'טיוטות', 'ממתינים לתשלום']);
  assert.deepEqual(QUICK_ACTIONS.map((a) => a.path), ['/orders/new', '/orders/new', '/orders']);
  const m = buildActionsModel({ allowed: HEAD, draftCount: 2 });
  assert.equal(m.state, 'ok'); assert.equal(m.count, 3); assert.deepEqual(m.items.map((r) => r.action), ['new-order', 'drafts', 'unpaid']);
  assert.deepEqual(m.items.map((r) => r.icon), ['plus', 'pencil', 'wallet']);
  assert.equal(m.items[1].tail, '2 בעמדה'); assert.equal(m.items[0].tail, ''); assert.equal(m.items[2].tail, '');
  assert.equal(m.note, 'מוצגות רק פעולות שההרשאות שלך מאפשרות.'); assert.equal(m.head, 'פעולות מהירות');
});
t('עובדת בלי "הזמנה חדשה": רק "ממתינים לתשלום"; בלי שום הרשאה: הודעה + "פני להנהלה"; הרשאות שטרם נטענו: טוען, בלי שורות', () => {
  const w = buildActionsModel({ allowed: WORKER });
  assert.deepEqual(w.items.map((r) => r.action), ['unpaid']);
  const none = buildActionsModel({ allowed: new Set() });
  assert.equal(none.items.length, 0); assert.equal(none.none, ACTIONS_TEXT.noneAll); assert.equal(none.sub, 'אם חסרה לך הרשאה, פני להנהלה.');
  const loading = buildActionsModel({ allowed: null });
  assert.equal(loading.state, 'loading'); assert.equal(loading.items.length, 0, 'כשל-סגור: בלי הרשאות לא מציגים פעולות');
  assert.equal(buildActionsModel({}).state, 'loading');
  assert.equal(buildActionsModel({ allowed: (p) => p === '/orders' }).items.length, 1, 'allowed יכול להיות גם פונקציה');
});
t('הקלדה אחרי # מסננת לפי הכותרת; אין התאמה = הודעה עם הטקסט (ולא "אין הרשאה")', () => {
  assert.deepEqual(buildActionsModel({ allowed: HEAD, term: 'טיוט' }).items.map((r) => r.action), ['drafts']);
  assert.deepEqual(buildActionsModel({ allowed: HEAD, term: ' ממתינים ' }).items.map((r) => r.action), ['unpaid']);
  const m = buildActionsModel({ allowed: HEAD, term: 'zzz' });
  assert.equal(m.items.length, 0); assert.equal(m.none, 'אין פעולה מהירה שמתאימה ל“zzz”'); assert.equal(m.sub, '');
  assert.equal(buildActionsModel({ allowed: WORKER, term: 'טיוט' }).none, 'אין פעולה מהירה שמתאימה ל“טיוט”', 'פעולה בלי הרשאה לא מוצגת גם בחיפוש');
});
t('menuAllowedPaths: מעץ התפריט האמיתי - הנהלה = שניהם; בלי page:orders_new = רק /orders; בלי page:orders = כלום', () => {
  const open = Object.fromEntries(NAV_PAGE_KEYS.map((k) => [k, true]));
  const paths = (perm, roleId = 3) => [...menuAllowedPaths(flattenMenuTree(buildMenuTree({ homeA5: true, user: { id: 'e', firstName: 'א', lastName: 'ב', roleId }, permissions: perm, settings: [] })))].sort();
  assert.deepEqual(paths(open, 0), ['/orders', '/orders/new']);
  assert.deepEqual(paths({ ...open, 'page:orders_new': false }), ['/orders']);
  assert.deepEqual(paths({ ...open, 'page:orders': false }), []);
  assert.deepEqual([...menuAllowedPaths(null)], []);
  const w = buildActionsModel({ allowed: menuAllowedPaths(flattenMenuTree(buildMenuTree({ homeA5: true, user: { id: 'e', firstName: 'א', lastName: 'ב', roleId: 3 }, permissions: { ...open, 'page:orders_new': false }, settings: [] }))) });
  assert.deepEqual(w.items.map((r) => r.action), ['unpaid'], 'PFX-01 מקצה לקצה: עובדת בלי הזמנה חדשה רואה רק ממתינים לתשלום');
});
t('draftTail: ספירה / "אין"', () => { assert.equal(draftTail(0), 'אין'); assert.equal(draftTail(1), '1 בעמדה'); assert.equal(draftTail(NaN), 'אין'); assert.equal(draftTail(undefined), 'אין'); });
t('actionTarget: הזמנה חדשה = ניווט; טיוטות / ממתינים = הרצה בדף הבית (/?run=unsaved | debts); לא מוכר = null', () => {
  assert.deepEqual(actionTarget('new-order'), { kind: 'nav', url: '/orders/new' });
  assert.deepEqual(actionTarget('drafts'), { kind: 'run', run: 'unsaved', url: '/?run=unsaved' });
  assert.deepEqual(actionTarget('unpaid'), { kind: 'run', run: 'debts', url: '/?run=debts' });
  for (const no of ['x', '', null, undefined, '__proto__']) assert.equal(actionTarget(no), null, String(no));
  for (const a of QUICK_ACTIONS) assert.ok(actionTarget(a.key), a.key);
  assert.deepEqual([...HOME_RUN_VALUES], ['debts', 'unsaved'], 'כל ערך run שהפעולות מייצרות מוכר בכתובת');
});
t('התוצאות: "ממתינים" = חיפוש מתקדם בתחום הזמנות עם סימון חובות; "טיוטות" = סימון "לא נשמר" + מזהי הטיוטות מ-localStorage (אותו מקור כמו רשימת ההזמנות)', () => {
  const fakeStorage = (entries) => ({ length: entries.length, key: (i) => entries[i][0], getItem: (k) => (entries.find((e) => e[0] === k) || [])[1] });
  const fresh = JSON.stringify({ savedAt: Date.now(), state: { x: 1 } });
  const stale = JSON.stringify({ savedAt: Date.now() - 40 * 86400000, state: { x: 1 } });
  const st = fakeStorage([['gemachOrderDraft:77', fresh], ['gemachOrderDraft:78', fresh], ['gemachOrderDraft:79', stale], ['other', fresh], ['gemachOrderDraft:x', fresh]]);
  assert.deepEqual(unsavedOrderIds(st), [77, 78], 'פגות / לא מספריות לא נספרות');
  const debts = { ...emptyAdv('orders'), flags: ['debts'] };
  const u1 = buildAdvRequest('orders', debts, st);
  assert.match(u1, /^\/api\/a5\/adv\?focus=orders&adv=/); assert.ok(decodeURIComponent(u1).includes('"flags":["debts"]'));
  const unsaved = { ...emptyAdv('orders'), flags: ['unsaved'] };
  const u2 = buildAdvRequest('orders', unsaved, st);
  assert.ok(decodeURIComponent(u2).includes('"flags":["unsaved"]')); assert.ok(u2.includes('unsaved=77%2C78'));
  assert.deepEqual(advSummaryParts(debts, 'orders'), ['חובות']); assert.deepEqual(advSummaryParts(unsaved, 'orders'), ['לא נשמר']);
});

console.log("'$' - חיפושים שמורים (PFX-04 אישיים, PFX-05 מצב ריק עם הסבר, תקרה 50)");
const L = (n) => Array.from({ length: n }, (_, i) => ({ id: 'id' + i, label: 'שם ' + i, query: 'שאילתה ' + i, domain: null }));
t('מודל ok: שורת "שמור חיפוש" ראשונה (עם החיפוש האחרון) ואחריה החיפושים; count = כמה שמורים; הערת "אישיים"', () => {
  const m = buildSavedModel({ state: 'ok', list: L(3), last: 'כהן ירושלים' });
  assert.equal(m.state, 'ok'); assert.equal(m.count, 3); assert.deepEqual(m.items.map((r) => r.type), ['save', 'saved', 'saved', 'saved']);
  assert.equal(m.items[0].sub, '“כהן ירושלים”'); assert.equal(m.items[0].disabled, false); assert.equal(m.items[0].query, 'כהן ירושלים');
  assert.equal(m.items[1].title, 'שם 0'); assert.equal(m.items[1].sub, '“שאילתה 0”'); assert.equal(m.items[1].id, 'id0');
  assert.equal(m.note, 'החיפושים השמורים אישיים: רק את רואה אותם.'); assert.equal(m.none, '');
});
t('בלי חיפוש אחרון: "שמור חיפוש" מושבתת עם הסבר; חיפוש שמתחיל בקידומת לא נחשב חיפוש אחרון', () => {
  const m = buildSavedModel({ state: 'ok', list: L(1), last: '' });
  assert.equal(m.items[0].disabled, true); assert.equal(m.items[0].sub, 'אין חיפוש אחרון לשמירה. חפשי משהו וחזרי לכאן.');
  assert.equal(buildSavedModel({ state: 'ok', list: [], last: '#שלום' }).items[0].disabled, true);
  assert.equal(buildSavedModel({ state: 'ok', list: [], last: '   ' }).items[0].disabled, true);
});
t('מצב ריק (PFX-05): הודעה + הסבר איך שומרים, ועדיין שורת "שמור חיפוש"', () => {
  const m = buildSavedModel({ state: 'ok', list: [], last: 'אלמוג 38' });
  assert.equal(m.count, 0); assert.equal(m.none, 'אין עדיין חיפושים שמורים'); assert.equal(m.sub, 'כדי לשמור: מחפשים משהו, כותבים $ ולוחצים על ״שמור חיפוש״.');
  assert.deepEqual(m.items.map((r) => r.type), ['save']);
});
t('סינון לפי מה שהוקלד אחרי $ (שם או שאילתה); אין התאמה = הודעה; שורת "שמור" נשארת', () => {
  const list = [{ id: 'a', label: 'כהן מירושלים', query: 'כהן ירושלים' }, { id: 'b', label: 'שמלות כלה', query: 'כלה 40' }];
  assert.deepEqual(buildSavedModel({ state: 'ok', list, term: 'כלה' }).items.filter((r) => r.type === 'saved').map((r) => r.id), ['b']);
  assert.deepEqual(buildSavedModel({ state: 'ok', list, term: 'ירושלים' }).items.filter((r) => r.type === 'saved').map((r) => r.id), ['a']);
  const none = buildSavedModel({ state: 'ok', list, term: 'zzz', last: 'x' });
  assert.equal(none.none, 'אין חיפוש שמור שמתאים ל“zzz”'); assert.equal(none.items[0].type, 'save'); assert.equal(none.count, 2);
});
t(`תקרה ${SAVED_SEARCH_LIMIT}: כשמלא "שמור חיפוש" מושבתת עם הסבר (השרת מסרב 409)`, () => {
  assert.equal(SAVED_SEARCH_LIMIT, 50);
  const m = buildSavedModel({ state: 'ok', list: L(50), last: 'x' });
  assert.equal(m.full, true); assert.equal(m.items[0].disabled, true); assert.equal(m.items[0].sub, SAVED_TEXT.saveFull);
  assert.equal(buildSavedModel({ state: 'ok', list: L(49), last: 'x' }).items[0].disabled, false);
});
t('מצבי טעינה / שגיאה (עם "נסי שוב") / טבלה חסרה (unavailable: בלי שורת שמירה, בלי 500) / רשומות פגומות נזרקות', () => {
  for (const s of ['idle', 'loading', undefined, 'weird']) assert.equal(buildSavedModel({ state: s }).state, 'loading');
  const err = buildSavedModel({ state: 'error' }); assert.equal(err.state, 'error'); assert.deepEqual(err.items.map((r) => r.type), ['retry']);
  const un = buildSavedModel({ state: 'unavailable', list: L(3), last: 'x' });
  assert.equal(un.state, 'unavailable'); assert.equal(un.items.length, 0); assert.equal(un.none, 'החיפושים השמורים אינם זמינים כרגע');
  const bad = buildSavedModel({ state: 'ok', list: [null, { id: 5, query: 'x' }, { id: 'ok', query: 'y' }, { id: 'q' }, 'str'] });
  assert.deepEqual(bad.items.filter((r) => r.type === 'saved').map((r) => r.id), ['ok']);
  assert.equal(buildSavedModel({ state: 'ok', list: null }).count, 0);
});
t('שורה עם תחום מוכר מציגה אותו; שם חסר = השאילתה; שאילתה ארוכה נחתכת בתצוגה בלבד', () => {
  const m = buildSavedModel({ state: 'ok', list: [{ id: 'a', label: '', query: 'כהן', domain: 'customers' }, { id: 'b', label: 'ארוך', query: 'א'.repeat(200), domain: 'nope' }] });
  assert.equal(m.items[1].title, 'כהן'); assert.equal(m.items[1].sub, '“כהן” · לקוחות');
  assert.ok(m.items[2].sub.length < 100); assert.ok(!m.items[2].sub.includes(' · '));
  assert.equal(m.items[2].query.length, 200, 'השאילתה המלאה נשמרת לריצה');
});
t('תחום שנשמר ב-DB לא תקין (constructor / __proto__ / toString / לא מחרוזת) לא נכנס לשורה כתווית', () => {
  const m = buildSavedModel({ state: 'ok', list: ['constructor', '__proto__', 'toString', 'hasOwnProperty', 5, {}, null].map((d, i) => ({ id: 'x' + i, label: 'n', query: 'q' + i, domain: d })) });
  for (const it of m.items.slice(1)) { assert.ok(!it.sub.includes(' · '), it.sub); assert.ok(!/function|object/i.test(it.sub), it.sub); }
});
t('saveCandidate / savePayload: מקוצץ, לא ריק, לא קידומת, עד 300; שם עד 80; הדגל לא מציע לשמור "#..."', () => {
  assert.equal(saveCandidate('  כהן ירושלים '), 'כהן ירושלים');
  for (const no of ['', '   ', '#abc', '$x', '@x', '&x', ' #x', null, undefined, 5]) assert.equal(saveCandidate(no), '', String(no));
  assert.equal(saveCandidate('א'.repeat(500)).length, SAVED_QUERY_MAX);
  assert.deepEqual(savePayload('  כהן '), { label: 'כהן', query: 'כהן', domain: null });
  assert.deepEqual(savePayload('כהן', ' שם יפה '), { label: 'שם יפה', query: 'כהן', domain: null });
  assert.equal(savePayload('כהן', 'ב'.repeat(200)).label.length, SAVED_LABEL_MAX);
  assert.equal(savePayload('#x'), null); assert.equal(savePayload(''), null);
  assert.equal(defaultSaveLabel('ג'.repeat(200)).length, 80);
});
t('isQuerySaved: אותה שאילתה בדיוק (אחרי קיצוץ) = שמור; אחרת לא', () => {
  const list = [{ id: 'a', label: 'x', query: 'כהן ירושלים' }];
  assert.equal(isQuerySaved(list, ' כהן ירושלים '), true); assert.equal(isQuerySaved(list, 'כהן'), false);
  assert.equal(isQuerySaved(list, ''), false); assert.equal(isQuerySaved(null, 'כהן'), false); assert.equal(isQuerySaved(list, '#כהן ירושלים'), false);
});

console.log('מדריך הקיצורים (PFX-07)');
t('חמש שורות @ # $ & % עם שם והסבר; "&" נעלמת בלי הרשאה (mineUsable=false), "%" תמיד', () => {
  assert.deepEqual(SHORTCUT_GUIDE.map((g) => g.ch), ['@', '#', '$', '&', '%']);
  assert.ok(SHORTCUT_GUIDE.every((g) => g.title && g.sub));
  assert.deepEqual(guideRows().map((g) => g.ch), ['@', '#', '$', '&', '%']);
  assert.deepEqual(guideRows({ mineUsable: false }).map((g) => g.ch), ['@', '#', '$', '%']);
  const pct = SHORTCUT_GUIDE.find((g) => g.ch === '%');
  assert.equal(pct.title, 'מילות מפתח'); assert.ok(/מידה/.test(pct.sub) && /דגם/.test(pct.sub) && /ברקוד/.test(pct.sub) && /תאריך/.test(pct.sub), 'ההסבר מונה את המילים');
  for (const g of SHORTCUT_GUIDE) assert.ok(QUICK_PREFIXES[g.ch], 'כל סימן במדריך הוא קידומת רשומה');
});

console.log('/?run= ב-parseHomeParams');
t('run רק ערכים מהרשימה הסגורה; adv ו-recent גוברים עליו; הוא גובר על scope; מפתח ההוראה', () => {
  assert.equal(parseHomeParams('?run=debts').run, 'debts'); assert.equal(parseHomeParams('?run=unsaved').any, true);
  for (const bad of ['', 'x', 'DEBTS', 'debts,unsaved', '../x', '__proto__']) { const r = parseHomeParams('?run=' + encodeURIComponent(bad)); assert.equal(r.run, null, bad); assert.equal(r.any, false, bad); }
  assert.equal(parseHomeParams('?run=debts&adv=1').run, null); assert.equal(parseHomeParams('?run=debts&recent=mine').run, null);
  const withScope = parseHomeParams('?run=debts&scope=orders'); assert.equal(withScope.run, 'debts'); assert.equal(withScope.scope, null);
  assert.equal(homeDirectiveKey(parseHomeParams('?run=unsaved')), 'run:unsaved');
  assert.equal(parseHomeParams('?scope=orders').run, null);
});

console.log('חיווט (בדיקה סטטית של המקורות)');
t('QuickPrefix.js: PREFIX_SOURCES כולל actions ו-saved; אין fetch חדש בקובץ (הטעינות ב-savedSearches.js)', () => {
  const comp = src('../app/components/search/QuickPrefix.js');
  assert.ok(/PREFIX_SOURCES\s*=\s*\{[\s\S]*mine:[\s\S]*actions:[\s\S]*saved:/.test(comp));
  assert.equal((comp.match(/fetch\(/g) || []).length, 2, 'רק שתי הקריאות של "השינויים שלי"');
});

t('דף הבית: "#" ו-"$" מחווטים (actions + saved), פעולות מנותבות ל-actionTarget, חיפוש שמור רץ מיד, הרשאות = navPaths (כשל-סגור עד שנטענו)', () => {
  const home = src('../app/components/home/HomeA5.js');
  assert.ok(/useQuickPrefix\(\{[\s\S]*mine, actions, saved/.test(home), 'HomeA5 מעביר actions ו-saved');
  assert.ok(/useMemo\(\(\) => \(\{ allowed: navPaths, draftCount \}\), \[navPaths, draftCount\]\)/.test(home), 'ההרשאות = navPaths (null עד שה-boot נטען)');
  assert.ok(/row\.type === 'action'[\s\S]{0,260}actionTarget\(row\.action\)[\s\S]{0,200}router\.push\(tg\.url\)[\s\S]{0,60}runQuick\(tg\.run\)/.test(home));
  assert.ok(/row\.type === 'saved'\) \{ setQ\(row\.query\); runSearch\(row\.query\)/.test(home), 'חיפוש שמור רץ בלחיצה');
  assert.ok(/const runQuick = useCallback\(\(kind\) => \{[\s\S]{0,200}emptyAdv\('orders'\), flags: \[kind\][\s\S]{0,200}applyAdv\(false, a\)/.test(home), 'חובות / טיוטות = חיפוש מתקדם בתחום הזמנות');
  assert.ok(/if \(dir\.run\) \{[\s\S]{0,260}setPendingRun\(dir\.run\)[\s\S]{0,200}replaceUrl/.test(home), '/?run= מופעל ונמחק מהכתובת');
  assert.ok(/useEffect\(\(\) => \{ if \(!pendingRun\) return; setPendingRun\(null\); runQuick\(pendingRun\)/.test(home) && home.indexOf('runQuick(pendingRun)') > home.indexOf('const runQuick = useCallback'), 'ההרצה באפקט שאחרי runQuick (לא ref שמוקצה אחרי אפקט הפתיחה); בדיקת התנהגות: scripts/home-bg-audit/test_run_directive.mjs');
  assert.ok(/if \(!ai\) rememberSearch\(query\)/.test(home), 'החיפוש האחרון + היסטוריה נרשמים בהרצת חיפוש רגיל (לא חכם)');
  assert.ok(!/fetch\(['"`]\/api\/(saved-searches|search-history)/.test(home), 'HomeA5 לא קורא לנתיבים ישירות');
});
t('מדריך הקיצורים: כפתור רק בדף הבית, לפני חיפוש (שדה ריק, בלי תוצאות, לא בחיפוש חכם), ראשון בשורה (= ימין ב-RTL); בתפריט אין אותו (PFX-08)', () => {
  const home = src('../app/components/home/HomeA5.js');
  assert.ok(/const showGuide = !compact && !q && !loading && !ai;/.test(home));
  assert.ok(/<div className="cmode">\s*\{showGuide && <GuideButton/.test(home), 'הכפתור הוא הילד הראשון של .cmode');
  assert.ok(/guideOpen && <GuideDialog rows=\{guideRows\(\{ mineUsable: mine\.state !== 'denied' \}\)\}/.test(home));
  assert.ok(/const tryChar = \(ch\) => \{[\s\S]{0,80}setGuideOpen\(false\);[\s\S]{0,40}setQ\(ch\)/.test(home), '"נסה" מכניס את הסימן לשדה');
  const menu = src('../app/components/menu/MenuSearchPanel.js');
  assert.ok(!/GuideButton|GuideDialog/.test(menu), 'בחיפוש התפריט אין מדריך');
  const ui = src('../app/components/search/ShortcutsUi.js');
  assert.ok(/pfxwin \$\{cls\}/.test(ui) && /id="dlg"/.test(ui) && /dlg-dark/.test(ui), 'החלון הכהה של הפלטה (#dlg + dlg-dark)');
  assert.ok(/createPortal\(/.test(ui) && /e\.key === 'Escape'/.test(ui) && /e\.key !== 'Tab'/.test(ui), 'portal, Esc, מלכודת מיקוד');
  assert.ok(!/window\.(alert|confirm)|\balert\(|window\.customConfirm/.test(ui + src('../app/components/search/QuickPrefix.js') + src('../app/components/search/savedSearches.js')), 'בלי alert / confirm של הדפדפן');
});
t('אייקון שמירה (PFX-09): i-bookmark (סימנייה, אייקון 81 בפלטה; לא עוד i-archive), נעלם לקידומת / ריק / unavailable; הודעת "החיפוש נשמר"; דגל ✓ לרגע', () => {
  const ui = src('../app/components/search/ShortcutsUi.js');
  assert.ok(/QIcon id=\{st === 'done' \? 'check' : 'bookmark'\}/.test(ui));
  assert.ok(!/'archive'/.test(ui), 'האייקון archive כבר לא משמש לשמירת חיפוש');
  assert.equal(SAVED_TEXT.saveIconLabel, 'שמירת חיפוש', 'שם נגיש בעברית');
  assert.ok(/aria-label=\{label\}/.test(ui) && /SAVED_TEXT\.saveIconLabel/.test(ui), 'aria-label = "שמירת חיפוש" (לא רק טולטיפ)');
  assert.ok(/saved\.state === 'unavailable'\) return null/.test(ui) && /saveCandidate\(text\)/.test(ui));
  assert.equal(SAVED_TEXT.savedToast, 'החיפוש נשמר');
  const store = src('../app/components/search/savedSearches.js');
  assert.ok(/say\(SAVED_TEXT\.savedToast, '“' \+ payload\.label \+ '”'\)/.test(store), 'הודעה אחרי שמירה');
  const sprite = src('../app/components/menu/spriteSymbols.js');
  for (const id of ['bookmark', 'check', 'info', 'trash', 'x', 'plus', 'pencil', 'wallet', 'search', 'lock']) assert.ok(sprite.includes(`["${id}",`), 'חסר אייקון בספרייט: ' + id);
  const palette = src('../design-system/sprite.svg');
  assert.ok(palette.includes('<symbol id="i-bookmark"') && palette.includes('81 סמלים'), 'הסמל בפלטה (sprite.svg) והמונה בכותרת');
  const iconsJson = JSON.parse(src('../design-system/icons.json')).icons;
  assert.deepEqual(iconsJson[iconsJson.length - 1], { n: 81, id: 'bookmark', label: 'שמירת חיפוש (סימנייה)', usage: { home: 0, order: 0 } }, 'אייקון 81 מצורף בסוף (בלי מספור מחדש)');
  assert.equal(iconsJson.find((x) => x.id === 'archive').n, 75, 'archive נשאר 75');
  assert.equal(JSON.parse(src('../design-system/build/numbers.json')).icon.bookmark, 81, 'מרשם המספרים');
  assert.ok(/אייקון 81 \| `i-bookmark`/.test(src('../design-system/COMPONENTS.md')), 'שורה בקטלוג הרכיבים');
  const home = src('../app/components/home/HomeA5.js');
  assert.ok(/!loading && <SaveIconButton text=\{q\} saved=\{saved\} ibtn \/>/.test(home), 'ליד ה-X בשדה הבית');
  assert.ok(/<SaveIconButton text=\{q\} saved=\{saved\} \/>/.test(src('../app/components/menu/MenuSearchPanel.js')), 'בשדה התפריט / המגירה (אותו SearchBody)');
});
t('מחיקה: X לכל שורה, אישור בחלון כהה, "אל תשאל שוב" עד רענון (tooltip), מקש Delete על שורה מסומנת', () => {
  const qp = src('../app/components/search/QuickPrefix.js');
  assert.ok(/e\.key === 'Delete' && askDelete && act >= 0 && items\[act\] && items\[act\]\.type === 'saved'/.test(qp));
  assert.ok(/selectionStart === el\.value\.length/.test(qp), 'Delete רק כשהסמן בסוף השורה (לא מוחק טקסט שמוקלד)');
  assert.ok(/className="inpx pfx-del"/.test(qp) && /data-tip="מחיקה"/.test(qp));
  const ui = src('../app/components/search/ShortcutsUi.js');
  assert.ok(/data-tip=\{SAVED_TEXT\.noAskTip\}/.test(ui) && SAVED_TEXT.noAskTip === 'יישמר עד לרענון' && /role="switch"/.test(ui));
  const menu = src('../app/components/menu/MenuSearchPanel.js');
  assert.ok(/saved\.confirm && <DeleteDialog/.test(menu) && /saved\.confirm && <DeleteDialog/.test(src('../app/components/home/HomeA5.js')));
});
t('חיפוש התפריט והמגירה: אותן קידומות (& # $), הרשאות מעץ התפריט, ניווט ל-/?run= ול-/?q=, השעיית חיפוש השרת כשהרשימה מוצגת; בלי קוד ל-@', () => {
  const menu = src('../app/components/menu/MenuSearchPanel.js');
  assert.ok(/menuAllowedPaths\(flattenMenuTree\(tree\)\)/.test(menu));
  assert.ok(/actionTarget\(row\.action\)/.test(menu) && /HOME_NAV_EVENT, \{ detail: \{ href: tg\.url \}/.test(menu));
  assert.ok(/\/\?q=\$\{encodeURIComponent\(row\.query\)\}/.test(menu), 'חיפוש שמור בתפריט נפתח כ-/?q=');
  assert.ok(/const prefixOn = qp\.open && !!qp\.def;/.test(menu));
  assert.ok(/ShortcutMenuList/.test(menu) && /SaveForm qp=\{qp\} menu/.test(menu) && /SavedDelButton/.test(menu));
  assert.ok(/usePopup\(\)/.test(menu) && /showToast\(text \? `\$\{title\}: \$\{text\}` : title, kind === 'error' \? 'error' : kind === 'info' \? 'info' : 'success'\)/.test(menu), 'הודעות דרך ה-popup של האתר (לא window.alert)');
});
t('CSS: כללי .pfx-* ב-home.css בהיקף .gm-ds.gm-home, ב-menu.css בהיקף .gm-ds.gm-menu (או עטיפת החלון .gm-ds.pfx-dlg-root), בלי font-family ובלי צבע hex', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const rulesOf = (css) => strip(css).split('}').map((x) => x.trim()).filter((x) => /\.pfx-/.test(x.split('{')[0]));
  const home = rulesOf(src('../app/components/home/home.css'));
  const menu = rulesOf(src('../app/components/menu/menu.css'));
  assert.ok(home.length >= 25 && menu.length >= 20, 'כללים: ' + home.length + ' / ' + menu.length);
  for (const r of home) {
    const [sel, body] = r.split('{');
    for (const one of sel.split(',')) assert.ok(/^\s*(@media[^{]*\{\s*)?\.gm-ds\.gm-home[ .]/.test(one) || /^\s*\.gm-ds\.gm-home\.pfx-dlg-root/.test(one), 'מחוץ להיקף (home): ' + one);
    assert.ok(!/font-family|#[0-9a-f]{3,8}\b/i.test(body), 'גופן / hex ב-' + sel);
    assert.ok(!/!important/.test(body), '!important ב-' + sel);
    for (const m of body.matchAll(/var\(--([a-z0-9-]+)/gi)) assert.ok(m[1].startsWith('gm-') || m[1] === 'k-ghost', 'משתנה לא gm-: --' + m[1]);
  }
  for (const r of menu) {
    const [sel, body] = r.split('{');
    for (const one of sel.split(',')) assert.ok(/^\s*(@media[^{]*\{\s*)?\.gm-ds\.(gm-menu|pfx-dlg-root)/.test(one), 'מחוץ להיקף (menu): ' + one);
    assert.ok(!/font-family|#[0-9a-f]{3,8}\b/i.test(body), 'גופן / hex ב-' + sel);
    assert.ok(!/!important/.test(body), '!important ב-' + sel);
    for (const m of body.matchAll(/var\(--([a-z0-9-]+)/gi)) assert.ok(m[1].startsWith('gm-') || m[1] === 'k-ghost', 'משתנה לא gm-: --' + m[1]);
  }
});
t('CSS: בטלפון כפתור "קיצורים" אייקון בלבד (PFX-11 ב) - @media (max-width: 767px) אחרי הכלל הלא-מותנה; X מחיקה תמיד גלוי במגע', () => {
  const home = src('../app/components/home/home.css');
  const i = home.indexOf('.pfx-help');
  assert.ok(i > 0 && /@media \(max-width: 767px\) \{\s*\.gm-ds\.gm-home \.hero \.cmode \.pfx-help/.test(home));
  assert.ok(/pfx-help-t \{ display: none; \}/.test(home));
  const menu = src('../app/components/menu/menu.css');
  assert.ok(/@media \(hover:none\),\(max-width:767px\)\{\.gm-ds\.gm-menu \.pfx-menu \.pfx-del\{opacity:1\}\}/.test(menu));
});

console.log("'%' - מילות מפתח (רשימת מה אפשר להקליד; בחירה מכניסה את המילה לשדה)");
t("buildKeywordsModel: שורה לכל פריט ב-KEYWORD_GUIDE (מקור אחד עם המנתח), לפי הסדר, עם אייקון / כותרת / הסבר / דוגמה", () => {
  const m = buildKeywordsModel({});
  assert.equal(m.state, 'ok'); assert.equal(m.head, 'מילות מפתח'); assert.equal(m.count, KEYWORD_GUIDE.length); assert.equal(m.items.length, 9);
  assert.deepEqual(m.items.map((r) => r.id), KEYWORD_GUIDE.map((k) => k.id));
  assert.deepEqual(m.items.map((r) => r.title), ['מידה', 'דגם', 'כמה דגמים', 'כמה מידות', 'תאריך עברי', 'מלאי ליום מסוים', 'ברקוד', 'מספר הזמנה', 'טלפון']);
  assert.deepEqual(m.items.map((r) => r.example), ['מידה 2', 'דגם 3', 'דגם 511,455', 'מידה 4,6', 'כז תשרי', 'מידה 4 דגם 511 כ חשוון', '6323401', '25734', '050-1234567']);
  for (const r of m.items) assert.ok(!/\d{1,2}[/.]\d{1,2}/.test(r.example + ' ' + r.sub), 'המדריך בעברית בלבד (בלי תאריך לועזי): ' + r.id);
  for (const r of m.items) { assert.equal(r.type, 'keyword'); assert.ok(r.icon && r.title && r.sub && r.tail === r.example, r.id); assert.ok(r.key.startsWith('kw:'), r.key); assert.ok(!('labels' in r)); }
  assert.deepEqual(new Set(m.items.map((r) => r.key)).size, m.items.length, 'מפתחות ייחודיים');
  assert.equal(m.noteIcon, 'info'); assert.equal(m.none, ''); assert.equal(m.note, KEYWORDS_TEXT.note);
});
t("buildKeywordsModel: סינון לפי מה שהוקלד אחרי '%' (תווית / דוגמה / מילים מזוהות, לא ההסבר), בלי התאמה = הודעה", () => {
  assert.deepEqual(buildKeywordsModel({ term: 'מידה' }).items.map((r) => r.id), ['size', 'multiSize', 'combo']);
  assert.deepEqual(buildKeywordsModel({ term: ' תאריך ' }).items.map((r) => r.id), ['hebrewDate']);
  assert.deepEqual(buildKeywordsModel({ term: 'חשוון' }).items.map((r) => r.id), ['combo']);
  assert.deepEqual(buildKeywordsModel({ term: 'נייד' }).items.map((r) => r.id), ['phone'], 'מילה מזוהה (נייד) בלי להופיע בתווית');
  assert.deepEqual(buildKeywordsModel({ term: '5/10' }).items.map((r) => r.id), [], 'אין שורת תאריך לועזי במדריך (התאריכים בעברית)');
  assert.deepEqual(buildKeywordsModel({ term: 'מדה' }).items.map((r) => r.id), ['size'], 'האיות החלופי מדה');
  const none = buildKeywordsModel({ term: 'zzz' });
  assert.equal(none.items.length, 0); assert.equal(none.none, KEYWORDS_TEXT.none); assert.equal(none.count, 0);
  assert.equal(buildKeywordsModel().items.length, 9); assert.equal(buildKeywordsModel({ term: null }).items.length, 9);
});
t("keywordInsert: יש מילה = המילה והסמן בסופה; אין מילה (תאריך) = הדוגמה כולה מסומנת; קלט חריג בטוח", () => {
  const byId = (id) => buildKeywordsModel({}).items.find((r) => r.id === id);
  assert.deepEqual(keywordInsert(byId('size')), { text: 'מידה ', start: 5, end: 5 });
  assert.deepEqual(keywordInsert(byId('model')), { text: 'דגם ', start: 4, end: 4 });
  assert.deepEqual(keywordInsert(byId('barcode')), { text: 'ברקוד ', start: 6, end: 6 });
  assert.deepEqual(keywordInsert(byId('orderNumber')), { text: 'הזמנה ', start: 6, end: 6 });
  assert.deepEqual(keywordInsert(byId('phone')), { text: 'טלפון ', start: 6, end: 6 });
  assert.deepEqual(keywordInsert(byId('hebrewDate')), { text: 'כז תשרי', start: 0, end: 7 });
  assert.deepEqual(keywordInsert(byId('multiModel')), { text: 'דגם 511,455', start: 0, end: 11 });
  assert.deepEqual(keywordInsert(byId('multiSize')), { text: 'מידה 4,6', start: 0, end: 8 });
  assert.deepEqual(keywordInsert(byId('combo')), { text: 'מידה 4 דגם 511 כ חשוון', start: 0, end: 22 });
  assert.deepEqual(keywordInsert(null), { text: '', start: 0, end: 0 }); assert.deepEqual(keywordInsert({}), { text: '', start: 0, end: 0 });
});
t("הרשימה מבטיחה רק מה שהמנתח מבין: כל דוגמה מסווגת, ו-insert + ערך מזוהה (מידה 2 / דגם 3 / ברקוד ... / הזמנה ... / טלפון ...)", () => {
  assert.equal(classifyQuery('מידה 2').kind, 'sizeKeyword'); assert.equal(classifyQuery('דגם 3').kind, 'modelKeyword');
  assert.equal(classifyQuery('כז תשרי').kind, 'date'); assert.equal(classifyQuery('כז תשרי').date.calendar, 'hebrew');
  assert.equal(classifyQuery('5/10').kind, 'date'); assert.equal(classifyQuery('5/10').date.calendar, 'gregorian');
  assert.equal(classifyQuery('6323401').kind, 'barcode'); assert.equal(classifyQuery('25734').kind, 'orderNumber'); assert.equal(classifyQuery('050-1234567').kind, 'phone');
  for (const r of buildKeywordsModel({}).items.filter((x) => x.insert)) {
    const typed = r.insert + ({ size: '2', model: '3', barcode: '6323401', orderNumber: '25734', phone: '0501234567' })[r.id];
    const kw = parseKeywords(typed);
    assert.equal(kw.count, 1, r.id + ': ' + typed); assert.equal(kw.rest, '', r.id);
    assert.equal(kw[{ size: 'size', model: 'model', barcode: 'barcode', orderNumber: 'orderNumber', phone: 'phone' }[r.id]] !== null, true, r.id);
  }
});
t("'%' בשורת חיפוש לא נשמר כחיפוש שמור (כמו # $ & @), אבל '100%' כן; ושורת '%' נשארת ללא חיפוש שרת (מוצגת כרשימה)", () => {
  assert.equal(saveCandidate('%'), ''); assert.equal(saveCandidate('%מידה'), ''); assert.equal(saveCandidate(' %מידה'), '');
  assert.equal(saveCandidate('100%'), '100%'); assert.equal(saveCandidate('כהן %'), 'כהן %');
  assert.equal(resolveQuickPrefix('%').prefix, '%'); assert.equal(resolveQuickPrefix('%', { prefixes: ['&', '#', '$', '%'] }).def.source, 'keywords');
  assert.equal(resolveQuickPrefix('%', { prefixes: ['&', '#', '$'] }), null, 'מקום שלא מפעיל');
  for (const flags of [{ mineUsable: false }, { actionsUsable: false }, { savedUsable: false }]) assert.equal(resolveQuickPrefix('%מידה', flags).prefix, '%', "'%' לא תלויה במקורות של קידומות אחרות");
  assert.equal(resolveQuickPrefix('%מידה', { enabled: false }), null, 'בחיפוש חכם (enabled=false) % היא טקסט');
});
t("חיווט '%': PREFIX_SOURCES.keywords (מקור סטטי), דף הבית ותפריט מכניסים את המילה לשדה בלי ניווט ובלי חיפוש, אייקון הערה info", () => {
  const qp = src('../app/components/search/QuickPrefix.js');
  assert.ok(/keywords: \{ buildModel: \(\{ term \}\) => buildKeywordsModel\(\{ term \}\), List: KeywordsList \}/.test(qp));
  assert.ok(/<QIc id=\{m\.noteIcon \|\| 'lock'\} \/>/.test(qp), 'הערת התחתית: info ל-% (מנעול לשאר)');
  const home = src('../app/components/home/HomeA5.js');
  assert.ok(/if \(row\.type === 'keyword'\) \{[\s\S]{0,260}keywordInsert\(row\)[\s\S]{0,120}setQ\(k\.text\)[\s\S]{0,260}setSelectionRange\(k\.start, k\.end\)[\s\S]{0,80}return;/.test(home), 'בבית: setQ + סמן / בחירה, בלי runSearch');
  assert.ok(/import \{[^}]*keywordInsert[^}]*\} from '@\/lib\/quickShortcuts'/.test(home));
  const menu = src('../app/components/menu/MenuSearchPanel.js');
  assert.ok(/if \(row\.type === 'keyword'\) \{[\s\S]{0,200}search\.setQ\(k\.text\)[\s\S]{0,260}setSelectionRange\(k\.start, k\.end\)[\s\S]{0,80}return;/.test(menu), 'בתפריט: אותו דבר, בלי onGo');
  assert.ok(/<Ic n=\{m\.noteIcon \|\| 'lock'\} \/>/.test(menu));
  assert.ok(!/QUICK_PREFIXES\['%'\][\s\S]{0,30}source: 'mine'/.test(src('../lib/quickPrefix.js')));
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
