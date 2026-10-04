// בדיקות הקידומות '#' (פעולות מהירות) ו-'$' (חיפושים שמורים) ומדריך הקיצורים: lib/quickShortcuts.js + lib/quickPrefix.js + /?run= ב-homeLogic.
// טהור: בלי DB, DOM או רשת. החיווט (הרכיבים) נבדק סטטית בסוף הקובץ. עיצוב: תצוגות-עיצוב/חיפוש-קיצורים.html (החלטות PFX-01..11).
// הרצה: node scripts/test_quick_prefix_shortcuts.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUICK_PREFIXES, detectQuickPrefix, resolveQuickPrefix } from '../lib/quickPrefix.js';
import {
  SAVED_SEARCH_LIMIT, SAVED_LABEL_MAX, SAVED_QUERY_MAX, SHORTCUT_GUIDE, guideRows, QUICK_ACTIONS, actionTarget, draftTail, buildActionsModel,
  saveCandidate, defaultSaveLabel, isQuerySaved, buildSavedModel, savePayload, SAVED_TEXT, ACTIONS_TEXT,
} from '../lib/quickShortcuts.js';
import { parseHomeParams, homeDirectiveKey, HOME_RUN_VALUES } from '../app/components/home/homeLogic.js';
import { buildAdvRequest, emptyAdv, advSummaryParts, unsavedOrderIds } from '../app/components/home/homeAdvConfig.js';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log("קידומות: '#' ו-'$' ברישום");
t("QUICK_PREFIXES: '@' '&' '#' '$' - כל אחת עם source משלה; כתו ראשון בלבד", () => {
  assert.deepEqual(Object.keys(QUICK_PREFIXES), ['@', '&', '#', '$']);
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
t('ארבע שורות @ # $ & עם שם והסבר; "&" נעלמת בלי הרשאה (mineUsable=false)', () => {
  assert.deepEqual(SHORTCUT_GUIDE.map((g) => g.ch), ['@', '#', '$', '&']);
  assert.ok(SHORTCUT_GUIDE.every((g) => g.title && g.sub));
  assert.deepEqual(guideRows().map((g) => g.ch), ['@', '#', '$', '&']);
  assert.deepEqual(guideRows({ mineUsable: false }).map((g) => g.ch), ['@', '#', '$']);
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

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
