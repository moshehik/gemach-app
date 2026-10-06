// בדיקות לשאלון המדיניות (ביטולים וזיכויים) להנהלות: lib/policyQuestionnaire/*, המייל, החיווט של ה-API והדפים.
// שאלון אחד משותף לשני הגמחים; כל שאלה היא בחירה-אחת (single) או מרובת-בחירה (multi) + "אחר" + "עדיין לא החלטנו".
// התשובות נשמרות בשרשור דיווח-תקלה (ErrorReport + ErrorReportReply) - בלי טבלה ובלי DDL; כאן הכול מול Prisma מדומה בזיכרון.
// ללא DB, ללא רשת, ללא שליחת מייל. הרצה: node scripts/test_policy_questionnaire.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקת הרינדור בצד שרת (SSR) צריכה react-dom + typescript (node_modules של הפרויקט, או NODE_PATH); בלעדיהם היא מדולגת ומודפס SKIP.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUESTIONNAIRE_KEY, getQuestionnaire, getQuestionnaireByOrgKey, orgKeyForOrg, orgForOrgKey, todayKeyForOrgKey, OMITTED_TOPICS,
} from '../lib/policyQuestionnaire/questions-refunds-2026-10.js';
import { COMMON_BANK } from '../lib/policyQuestionnaire/common-bank.js';
import {
  UNDECIDED, OTHER, UNDECIDED_LABEL, OTHER_LABEL, UNANSWERED_LABEL, MAX_TEXT, KNOWN_SITE_ORIGINS, HINT_SINGLE, HINT_MULTI,
  flattenQuestions, findQuestion, stripReportIds, optionsForQuestion, publicQuestion, publicQuestionnaire, isMulti, emptyAnswer,
  toggleMultiChoice, isOptionOn, selectionHint,
  isQuestionVisible, visibleQuestions, normalizeAnswer, sanitizeAnswers, pruneHidden, isAnswered,
  computeProgress, validateSubmission, answerLabel, answerLines, summarize, tallyResponses, formatIsraelDateTime,
  resolveSiteOrigin, answerUrl, resultsUrl, classifyDbError, normalizeRespondent,
  THREAD_TITLE, threadMarker, buildThreadIntro, renderSubmissionText, parseSubmissionText, isSubmissionText, groupSubmissions, joinSubmissionTexts,
} from '../lib/policyQuestionnaire/logic.js';
import { buildQuestionnaireEmail } from '../lib/policyQuestionnaire/email.js';
import { draftKey, browserStorage, saveDraft, loadDraft, clearDraft } from '../lib/policyQuestionnaire/draft.js';
import { EMAIL_CATALOG, emailSubject } from '../lib/emailCatalog.js';
import { escapeHtml } from '../lib/emailTemplates.js';
import { currentOrg, ORG_MAIN, ORG_NEVE_YAAKOV } from '../lib/orgIdentity.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = (rel) => readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; } catch (e) { failed += 1; failures.push(`${name}\n    ${String(e && e.message).split('\n').join('\n    ')}`); }
}

const MAIN = getQuestionnaire(ORG_MAIN);
const NEVE = getQuestionnaire(ORG_NEVE_YAAKOV);
const BOTH = [MAIN, NEVE];
const MIN_QUESTIONS = 25;
const STAFF_NAMES = ['אביגיל', 'אהובה', 'רבקה', 'רחלי', 'יוסי', 'פינקל', 'דנה', 'שרה', 'מושה', 'משה'];
// שם מופיע כמילה שלמה (עם אות יחס אחת לכל היותר), כדי ש"השתמשה" לא ייתפס כ"משה"
const hasName = (text, n) => new RegExp('(?:^|[^א-ת])[בלמושהכ]?' + n + '(?![א-ת])').test(text);

// ---- עזרי תשובות כלליים (לא תלויים במזהים או במספר השאלות במאגר) ----
const mkAnswer = (q, o = {}) => (isMulti(q)
  ? { choices: o.choices || [], other: !!o.other, otherText: o.otherText || '', undecided: !!o.undecided, comment: o.comment || '' }
  : { choice: o.choice === undefined ? null : o.choice, otherText: o.otherText || '', comment: o.comment || '' });
/** האינדקס שכדאי לסמן בשאלה כדי ששאלות מותנות שתלויות בה יוצגו (אחרת 0). */
function pickIndex(qn, q) {
  const deps = flattenQuestions(qn).filter((d) => d.showIf && d.showIf.questionId === q.id);
  return deps.length ? deps[0].showIf.anyOf[0] : 0;
}
/** תשובות מלאות לכל השאלות הגלויות: אפשרות מתאימה לכל שאלה (כך ששאלות מותנות מוצגות), או "לא החלטנו" ב-mode='undecided'. */
function completeAnswers(qn, mode = 'visible') {
  const out = {};
  for (const q of flattenQuestions(qn)) {
    if (!isQuestionVisible(qn, q, out)) continue;
    if (mode === 'undecided') out[q.id] = isMulti(q) ? mkAnswer(q, { undecided: true }) : mkAnswer(q, { choice: UNDECIDED });
    else if (mode === 'first') out[q.id] = isMulti(q) ? mkAnswer(q, { choices: [0] }) : mkAnswer(q, { choice: 0 });
    else { const i = pickIndex(qn, q); out[q.id] = isMulti(q) ? mkAnswer(q, { choices: [i] }) : mkAnswer(q, { choice: i }); }
  }
  return out;
}
const firstOf = (qn, pred) => flattenQuestions(qn).find(pred);
const firstSingle = (qn) => firstOf(qn, (q) => !isMulti(q));
const firstMulti = (qn) => firstOf(qn, (q) => isMulti(q));
const dependents = (qn) => flattenQuestions(qn).filter((q) => q.showIf);
/** תשובה לשאלה השולטת שגורמת לשאלה המותנית להיות מוצגת / מוסתרת. */
function showingAnswer(qn, dep) { const c = findQuestion(qn, dep.showIf.questionId); const i = dep.showIf.anyOf[0]; return isMulti(c) ? mkAnswer(c, { choices: [i] }) : mkAnswer(c, { choice: i }); }
function hidingAnswer(qn, dep) { const c = findQuestion(qn, dep.showIf.questionId); return isMulti(c) ? mkAnswer(c, { undecided: true }) : mkAnswer(c, { choice: UNDECIDED }); }
const mailAnswers = (qn) => {
  const answers = completeAnswers(qn);
  const qs = visibleQuestions(qn, answers);
  const s = qs.find((q) => !isMulti(q)); const m = qs.find((q) => isMulti(q));
  answers[s.id] = mkAnswer(s, { choice: OTHER, otherText: 'שלושה ימים <b>מהאירוע</b> & עוד', comment: 'הערה "חשובה" לשאלה' });
  answers[m.id] = mkAnswer(m, { choices: [0, 1], other: true, otherText: 'סיבה <i>נוספת</i>', comment: '' });
  return answers;
};

// ---------------------------------------------------------------------------
// תקינות המאגר: שאלון אחד משותף
// ---------------------------------------------------------------------------
test('מפתח השאלון והמיפוי org -> org1/org2', () => {
  assert.equal(QUESTIONNAIRE_KEY, 'refunds-2026-10b');
  assert.equal(orgKeyForOrg(ORG_MAIN), 'org1');
  assert.equal(orgKeyForOrg(ORG_NEVE_YAAKOV), 'org2');
  assert.equal(orgKeyForOrg(undefined), 'org1');
  assert.equal(orgForOrgKey('org2'), ORG_NEVE_YAAKOV);
  assert.equal(orgForOrgKey('org1'), ORG_MAIN);
  assert.equal(todayKeyForOrgKey('org1'), 'main');
  assert.equal(todayKeyForOrgKey('org2'), 'neve');
  assert.equal(MAIN.orgKey, 'org1');
  assert.equal(NEVE.orgKey, 'org2');
  assert.equal(MAIN.gmachName, 'מכובד');
  assert.equal(NEVE.gmachName, 'נווה יעקב');
  assert.equal(getQuestionnaireByOrgKey('org1').gmachName, 'מכובד');
  assert.equal(getQuestionnaireByOrgKey('nope'), null);
});

test('currentOrg() של כל פרויקט Vercel מחזיר את השאלון הנכון (אותן שאלות, כותרת אחרת)', () => {
  assert.equal(getQuestionnaire(currentOrg({ VERCEL_PROJECT_PRODUCTION_URL: 'gmach-neve-yaakov.vercel.app' })).orgKey, 'org2');
  assert.equal(getQuestionnaire(currentOrg({ VERCEL_PROJECT_PRODUCTION_URL: 'gemach-app-uyh4-beryl.vercel.app' })).orgKey, 'org1');
  assert.equal(getQuestionnaire(currentOrg({ GEMACH_ORG: 'neve-yaakov' })).orgKey, 'org2');
  assert.equal(getQuestionnaire(currentOrg({})).orgKey, 'org1');
});

test('שאלון משותף: אותם מזהים, נוסחים, סוגים, אפשרויות ותנאי תצוגה בשני הגמחים; רק הכותרת ושורת "היום" שונות', () => {
  const strip = (qn) => flattenQuestions(qn).map(({ today_he, ...rest }) => rest);
  assert.deepEqual(strip(MAIN), strip(NEVE));
  assert.deepEqual(flattenQuestions(MAIN).map((q) => q.id), flattenQuestions(NEVE).map((q) => q.id));
  assert.deepEqual(MAIN.sections.map((s) => [s.title_he, s.intro_he]), NEVE.sections.map((s) => [s.title_he, s.intro_he]));
  assert.notEqual(MAIN.gmachName, NEVE.gmachName);
  assert.ok(MAIN.intro_he.includes(MAIN.gmachName) && NEVE.intro_he.includes(NEVE.gmachName), 'שם הגמ"ח בכותרת');
  assert.ok(!MAIN.intro_he.includes('{gmach}') && !NEVE.intro_he.includes('{gmach}'));
  const differing = flattenQuestions(MAIN).filter((q, i) => (q.today_he || '') !== (flattenQuestions(NEVE)[i].today_he || ''));
  assert.ok(differing.length >= 1, 'יש לפחות שאלה אחת עם מידע שונה לכל גמ"ח');
});

test(`מבנה: לפחות ${MIN_QUESTIONS} שאלות, מזהים ייחודיים ויציבים, סוגים single/multi בלבד, יש שאלות מרובות-בחירה, ממוספר לפי סעיף`, () => {
  for (const qn of BOTH) {
    const qs = flattenQuestions(qn);
    assert.ok(qs.length >= MIN_QUESTIONS, `${qs.length} שאלות`);
    assert.equal(new Set(qs.map((q) => q.id)).size, qs.length, 'מזהים ייחודיים');
    assert.ok(qs.every((q) => /^q\d+\.\d+$/.test(q.id)), 'מזהים בצורת q<סעיף>.<מספר>');
    assert.ok(qs.every((q) => q.kind === 'single' || q.kind === 'multi'), 'kind');
    assert.ok(qs.some((q) => q.kind === 'multi') && qs.some((q) => q.kind === 'single'));
    assert.ok(qn.sections.length >= 5 && qn.sections.every((s) => s.title_he && s.questions.length >= 1));
  }
});

test('לכל שאלה: >=2 אפשרויות ייחודיות ולא ריקות, נוסח שאלה, דוגמה, "אחר" מותר (מבחן אמריקאי), בלי source/sourceNote', () => {
  for (const q of flattenQuestions(MAIN)) {
    assert.ok(Array.isArray(q.options_he) && q.options_he.length >= 2, `${q.id} options`);
    assert.ok(q.options_he.every((o) => typeof o === 'string' && o.trim() && o === o.trim()), `${q.id} option text`);
    assert.equal(new Set(q.options_he).size, q.options_he.length, `${q.id} duplicate options`);
    assert.ok(q.text_he && q.text_he.trim().endsWith('?') || q.text_he.trim().length > 10, `${q.id} text`);
    assert.ok(q.example_he && q.example_he.trim(), `${q.id} example`);
    assert.equal(q.allowOther, true, `${q.id} allowOther`);
    assert.ok(!('source' in q) && !('sourceNote_he' in q), `${q.id} no source fields`);
    assert.ok(!q.options_he.some((o) => o === OTHER_LABEL || o === UNDECIDED_LABEL), `${q.id}: אחר/לא החלטנו מתווספות אוטומטית`);
  }
});

test('exclusive: רק בשאלה מרובת-בחירה, אינדקסים בטווח; showIf: השולטת קודמת לתלויה ואינדקסים בטווח (כולל שולטת מרובת-בחירה)', () => {
  const qs = flattenQuestions(MAIN);
  const ids = qs.map((q) => q.id);
  for (const q of qs) {
    if (q.exclusive) {
      assert.equal(q.kind, 'multi', `${q.id} exclusive רק ב-multi`);
      assert.ok(q.exclusive.every((i) => Number.isInteger(i) && i >= 0 && i < q.options_he.length), `${q.id} exclusive range`);
    }
    if (q.showIf) {
      const ctrl = findQuestion(MAIN, q.showIf.questionId);
      assert.ok(ctrl, `${q.id} showIf target exists`);
      assert.ok(ids.indexOf(ctrl.id) < ids.indexOf(q.id), `${q.id} controller first`);
      assert.ok(q.showIf.anyOf.length >= 1 && q.showIf.anyOf.every((i) => Number.isInteger(i) && i >= 0 && i < ctrl.options_he.length), `${q.id} anyOf range`);
    }
  }
});

test('מידע "היום" (today_he): בקובץ הנתונים null או {main, neve} עם טקסט; למשיבה מגיע כמחרוזת אחת לגמ"ח (או כלום); מידע בלבד, לא אפשרות בחירה', () => {
  for (const s of COMMON_BANK.sections) for (const q of s.questions) {
    if (q.today_he === null || q.today_he === undefined) continue;
    assert.equal(typeof q.today_he, 'object', `${q.id} today_he object`);
    assert.deepEqual(Object.keys(q.today_he).filter((k) => !['main', 'neve'].includes(k)), [], `${q.id} today_he keys`);
    for (const k of ['main', 'neve']) if (k in q.today_he) assert.ok(typeof q.today_he[k] === 'string' && q.today_he[k].trim(), `${q.id} today_he.${k}`);
  }
  for (const qn of BOTH) for (const q of flattenQuestions(qn)) {
    assert.ok(q.today_he === undefined || (typeof q.today_he === 'string' && q.today_he.trim()), `${q.id} built today_he`);
    if (q.today_he) assert.ok(!q.options_he.includes(q.today_he), 'today_he לא אפשרות');
  }
  assert.ok(flattenQuestions(MAIN).some((q) => q.today_he) && flattenQuestions(NEVE).some((q) => q.today_he));
});

test('סימון "כמו היום" באפשרות: לכל היותר אפשרות אחת בשאלה, ותמיד בסוף האפשרות (אותו כלל בשני הגמחים); שורת "היום" לא חוזרת על עצמה בין הגמחים בלי סיבה', () => {
  let marked = 0;
  for (const q of flattenQuestions(MAIN)) {
    const hits = q.options_he.filter((o) => o.includes('כמו היום'));
    assert.ok(hits.length <= 1, `${q.id}: יותר מאפשרות אחת מסומנת`);
    for (const h of hits) { assert.ok(h.endsWith('כמו היום'), `${q.id}: הסימון בסוף האפשרות`); marked += 1; }
  }
  assert.ok(marked >= 3, 'יש אפשרויות מסומנות "כמו היום"');
  for (const s of COMMON_BANK.sections) for (const q of s.questions) {
    if (q.today_he) for (const k of ['main', 'neve']) assert.ok(!/^כך זה עובד היום/.test(q.today_he[k] || ''), `${q.id}: הכותרת "כך זה עובד היום" מתווספת בתצוגה`);
  }
});

test('נושאים שהושמטו: רק טכניים, מתועדים, בלי מזהי דיווח ובלי שמות', () => {
  assert.ok(OMITTED_TOPICS.length >= 5);
  assert.ok(OMITTED_TOPICS.every((o) => o.topic_he && o.reason_he));
  const all = JSON.stringify(OMITTED_TOPICS);
  assert.ok(!/(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)\b[0-9a-f]{8}\b/.test(all), 'אין מזהי דיווח');
  assert.ok(!STAFF_NAMES.some((n) => hasName(all, n)), 'אין שמות');
});

test('אפשרויות "עדיין לא החלטנו" ו"אחר" מתווספות אוטומטית; הרמז לפי סוג השאלה', () => {
  const q = firstSingle(NEVE);
  const opts = optionsForQuestion(q);
  assert.equal(opts.length, q.options_he.length + 2);
  assert.equal(opts[opts.length - 1].value, UNDECIDED);
  assert.equal(opts[opts.length - 1].label, UNDECIDED_LABEL);
  assert.equal(opts[opts.length - 2].value, OTHER);
  assert.equal(opts[opts.length - 2].label, OTHER_LABEL);
  assert.equal(optionsForQuestion({ ...q, allowOther: false }).length, q.options_he.length + 1);
  assert.equal(selectionHint(q), HINT_SINGLE);
  assert.equal(selectionHint(firstMulti(NEVE)), HINT_MULTI);
  assert.equal(HINT_SINGLE, 'לסמן אחת');
  assert.equal(HINT_MULTI, 'אפשר לסמן כמה');
});

// ---------------------------------------------------------------------------
// טקסט שמוצג להנהלות: בלי מילים טכניות, שמות, מספרי הזמנה או מזהי דיווח
// ---------------------------------------------------------------------------
const FORBIDDEN = [
  ['הגדרה', /הגדר(?:ה|ות)/],
  ['קוד', /(?:^|[^א-ת])ה?קוד(?:ים)?(?![א-ת])/],
  ['SystemSetting', /SystemSetting/i],
  ['מערכת ההפעלה', /מערכת ההפעלה/],
  ['המערכת', /(?:^|[^א-ת])ה?מערכת(?![א-ת])/],
  ['מסד/DB/טבלה', /מסד נתונים|דאטה|(?:^|[^A-Za-z])DB(?![A-Za-z])|טבלת|טבל[הת]/],
  ['שרת/API/סקריפט', /(?:^|[^א-ת])שרת(?![א-ת])|\bAPI\b|סקריפט|\bcron\b|\bwebhook\b/i],
  ['פיתוח', /באג|דיבאג|ענף|קומיט|\bPR\b|\bbranch\b|\bcommit\b|פרגמנט|פלאג/i],
  ['טוגל', /טוגל|toggle/i],
  ['מזהה דיווח', /דיווח\s+[0-9a-f]{8}|(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)\b[0-9a-f]{8}\b/],
  ['מקור פנימי', /מסמך הרשאות|\bsource\b/],
  ['מספר הזמנה', /(?:^|[^\d,.])\d{5,}(?![\d,])/],
  ['מפתח/שדה', /\b[a-z]+_[a-z_]+\b/],
];
function managerFacingStrings(qn) {
  const out = [qn.intro_he, qn.gmachName];
  for (const s of qn.sections) {
    out.push(s.title_he, s.intro_he);
    for (const q of s.questions) out.push(q.text_he, q.example_he, q.today_he, ...optionsForQuestion(q).map((o) => o.label));
  }
  out.push(UNDECIDED_LABEL, OTHER_LABEL, HINT_SINGLE, HINT_MULTI);
  return out.filter(Boolean);
}
export const forbiddenHits = [];
test('מילים אסורות: אין בטקסט המוצג להנהלות מילים טכניות, שמות עובדות, מספרי הזמנה או מזהי דיווח', () => {
  for (const [label, qn] of [['org1', MAIN], ['org2', NEVE]]) {
    for (const text of managerFacingStrings(publicQuestionnaire(qn))) {
      for (const [word, re] of FORBIDDEN) if (re.test(text)) forbiddenHits.push({ org: label, word, text: text.slice(0, 90) });
      for (const n of STAFF_NAMES) if (hasName(text, n)) forbiddenHits.push({ org: label, word: `שם: ${n}`, text: text.slice(0, 90) });
    }
  }
  assert.deepEqual(forbiddenHits, [], `נמצאו ${forbiddenHits.length} פגיעות:\n${forbiddenHits.map((h) => `${h.org} [${h.word}] ${h.text}`).join('\n')}`);
});

test('הלינט תופס: מילה אסורה, מזהה דיווח, מספר הזמנה ושם; ולא תופס טקסט רגיל (סכומים, אחוזים, תאריכים)', () => {
  const bad = ['לפי ההגדרה הזו', 'דיווח c00b42cf, 5.10', 'הקוד מאשר', 'בטבלה', 'הזמנה 53082 בוטלה', 'show_thing_now'];
  for (const t of bad) assert.ok(FORBIDDEN.some(([, re]) => re.test(t)), `לא נתפס: ${t}`);
  for (const t of ['שמלת אישה 120 ₪ בוטלה', 'מעל 1,000 ₪', 'עד 14 ימים לפני האירוע, 50%', 'אחרי 15 דקות']) assert.ok(!FORBIDDEN.some(([, re]) => re.test(t)), `נתפס בטעות: ${t}`);
  assert.ok(hasName('אמרה לרחלי שכן', 'רחלי') && hasName('אביגיל ביקשה', 'אביגיל') && !hasName('אומרת שלא השתמשה בה', 'משה'));
});

test('stripReportIds מסיר מזהי דיווח ומשאיר טקסט רגיל', () => {
  assert.equal(stripReportIds('מקור (דיווח c00b42cf, 5.10) כאן'), 'מקור (5.10) כאן');
  assert.ok(!/[0-9a-f]{8}/.test(stripReportIds('דיווח 068cc53d + דיווח bb3978c5, 22.9')));
  assert.equal(stripReportIds('שמלה 120 ₪ בוטלה'), 'שמלה 120 ₪ בוטלה');
  assert.equal(stripReportIds(null), '');
});

test('publicQuestionnaire: לא מכיל source/sourceNote, שומר kind/exclusive/showIf/today_he', () => {
  for (const qn of BOTH) {
    const pub = publicQuestionnaire(qn);
    const json = JSON.stringify(pub);
    assert.ok(!json.includes('"source"') && !json.includes('sourceNote'));
    const qs = flattenQuestions(pub);
    assert.ok(qs.every((q) => q.kind === 'single' || q.kind === 'multi'));
    for (const q of flattenQuestions(qn)) {
      const p = qs.find((x) => x.id === q.id);
      assert.deepEqual(p.exclusive, q.exclusive);
      assert.deepEqual(p.showIf, q.showIf);
      assert.equal(p.today_he, q.today_he || '');
    }
  }
  assert.equal(publicQuestion({ id: 'x', text_he: 't', options_he: ['a', 'b'] }).kind, 'single');
});

// ---------------------------------------------------------------------------
// תצוגה מותנית (שולטת בחירה-אחת ושולטת מרובת-בחירה)
// ---------------------------------------------------------------------------
test('showIf במאגר: כל שאלה מותנית מוסתרת בלי תשובה, מוצגת כשהשולטת נענתה באפשרות המתאימה, ומוסתרת ב"לא החלטנו"/"אחר"', () => {
  for (const qn of BOTH) {
    const deps = dependents(qn);
    assert.ok(deps.length >= 1, 'יש לפחות שאלה מותנית אחת');
    for (const dep of deps) {
      const c = dep.showIf.questionId;
      assert.equal(isQuestionVisible(qn, dep, {}), false, `${dep.id} בלי תשובה`);
      assert.equal(isQuestionVisible(qn, dep, { [c]: showingAnswer(qn, dep) }), true, `${dep.id} מוצגת`);
      assert.equal(isQuestionVisible(qn, dep, { [c]: hidingAnswer(qn, dep) }), false, `${dep.id} לא החלטנו`);
      const ctrl = findQuestion(qn, c);
      const other = isMulti(ctrl) ? mkAnswer(ctrl, { other: true, otherText: 'x' }) : mkAnswer(ctrl, { choice: OTHER, otherText: 'x' });
      assert.equal(isQuestionVisible(qn, dep, { [c]: other }), false, `${dep.id} אחר`);
      const outside = ctrl.options_he.map((_, i) => i).find((i) => !dep.showIf.anyOf.includes(i));
      if (outside !== undefined) assert.equal(isQuestionVisible(qn, dep, { [c]: isMulti(ctrl) ? mkAnswer(ctrl, { choices: [outside] }) : mkAnswer(ctrl, { choice: outside }) }), false, `${dep.id} אפשרות אחרת`);
    }
  }
});

test('showIf עם שולטת מרובת-בחירה (סינתטי): מוצגת כשסומנה אחת מהאפשרויות, גם יחד עם אחרות; שרשרת מוסתרת; מעגל לא נתקע', () => {
  const qn = { sections: [{ title_he: 'x', questions: [
    { id: 'm', kind: 'multi', options_he: ['a', 'b', 'c'], allowOther: true },
    { id: 'd', kind: 'single', options_he: ['1', '2'], showIf: { questionId: 'm', anyOf: [1, 2] } },
    { id: 'e', kind: 'single', options_he: ['1', '2'], showIf: { questionId: 'd', anyOf: [0] } },
  ] }] };
  assert.deepEqual(visibleQuestions(qn, {}).map((q) => q.id), ['m']);
  assert.deepEqual(visibleQuestions(qn, { m: { choices: [0] } }).map((q) => q.id), ['m']);
  assert.deepEqual(visibleQuestions(qn, { m: { choices: [0, 2] } }).map((q) => q.id), ['m', 'd']);
  assert.deepEqual(visibleQuestions(qn, { m: { choices: [1] }, d: { choice: 0 } }).map((q) => q.id), ['m', 'd', 'e']);
  assert.deepEqual(visibleQuestions(qn, { m: { choices: [0] }, d: { choice: 0 } }).map((q) => q.id), ['m'], 'השולטת של e מוסתרת');
  assert.deepEqual(visibleQuestions(qn, { m: { choices: [], undecided: true } }).map((q) => q.id), ['m']);
  const cyc = { sections: [{ title_he: 'x', questions: [
    { id: 'a', options_he: ['1', '2'], showIf: { questionId: 'b', anyOf: [0] } },
    { id: 'b', options_he: ['1', '2'], showIf: { questionId: 'a', anyOf: [0] } },
    { id: 'd', options_he: ['1', '2'], showIf: { questionId: 'missing', anyOf: [0] } },
  ] }] };
  assert.deepEqual(visibleQuestions(cyc, { a: { choice: 0 }, b: { choice: 0 } }).map((q) => q.id), []);
});

test('pruneHidden מסיר תשובה לשאלה מוסתרת אחרי שינוי השולטת, ומשאיר אותה כשהיא מוצגת', () => {
  for (const qn of BOTH) {
    const dep = dependents(qn)[0];
    const c = dep.showIf.questionId;
    const base = { ...completeAnswers(qn) };
    assert.ok(base[dep.id], 'ברירת המילוי מציגה את המותנית');
    assert.ok(pruneHidden(qn, base)[dep.id]);
    const changed = { ...base, [c]: hidingAnswer(qn, dep) };
    const pruned = pruneHidden(qn, changed);
    assert.ok(!pruned[dep.id] && pruned[c]);
    assert.ok(Object.keys(pruned).length < Object.keys(changed).length);
  }
});

// ---------------------------------------------------------------------------
// ניקוי, תקינות ומיזוג
// ---------------------------------------------------------------------------
test('normalizeAnswer (בחירה-אחת): אינדקס חוקי, undecided, other עם טקסט; פסילת ערכים לא חוקיים', () => {
  const q = firstSingle(NEVE);
  assert.deepEqual(normalizeAnswer({ choice: 0 }, q), { choice: 0, otherText: '', comment: '' });
  assert.deepEqual(normalizeAnswer({ choice: UNDECIDED, otherText: 'x' }, q), { choice: UNDECIDED, otherText: '', comment: '' });
  assert.deepEqual(normalizeAnswer({ choice: OTHER, otherText: '  שלוש  ' }, q), { choice: OTHER, otherText: 'שלוש', comment: '' });
  for (const bad of [{ choice: 99 }, { choice: -1 }, { choice: 1.5 }, { choice: 'evil' }, 'x', null]) assert.equal(normalizeAnswer(bad, q), null);
  assert.equal(normalizeAnswer({ choice: OTHER }, { ...q, allowOther: false }), null, 'אחר אסור בשאלה בלי allowOther');
  assert.deepEqual(normalizeAnswer({ choice: null, comment: 'רק הערה' }, q), { choice: null, otherText: '', comment: 'רק הערה' });
  assert.equal(normalizeAnswer({ choice: 0, comment: 'א'.repeat(MAX_TEXT + 50) }, q).comment.length, MAX_TEXT);
});

test('normalizeAnswer (מרובת-בחירה): מיון, כפילויות, אינדקסים לא חוקיים, "אחר" רק עם allowOther, "לא החלטנו" מוציא את השאר, בלעדית', () => {
  const q = { id: 'm', kind: 'multi', options_he: ['a', 'b', 'c', 'none'], allowOther: true, exclusive: [3] };
  assert.deepEqual(normalizeAnswer({ choices: [2, 0, 2, 9, -1, 1.5, 'x'] }, q), { choices: [0, 2], other: false, otherText: '', undecided: false, comment: '' });
  assert.deepEqual(normalizeAnswer({ choices: [1], other: true, otherText: '  ט  ' }, q), { choices: [1], other: true, otherText: 'ט', undecided: false, comment: '' });
  assert.deepEqual(normalizeAnswer({ choices: [1], other: true, otherText: 'ט' }, { ...q, allowOther: false }), { choices: [1], other: false, otherText: '', undecided: false, comment: '' });
  assert.deepEqual(normalizeAnswer({ choices: [0, 1], other: true, otherText: 'x', undecided: true }, q), { choices: [], other: false, otherText: '', undecided: true, comment: '' });
  assert.deepEqual(normalizeAnswer({ choices: [0, 3] }, q), { choices: [3], other: false, otherText: '', undecided: false, comment: '' }, 'בלעדית מוציאה את השאר');
  assert.equal(normalizeAnswer({ choices: [], other: false }, q), null);
  assert.equal(normalizeAnswer({ choice: 1 }, q), null, 'צורת בחירה-אחת לא חוקית בשאלה מרובת-בחירה');
  assert.deepEqual(normalizeAnswer({ choices: [], comment: 'הערה בלבד' }, q), { choices: [], other: false, otherText: '', undecided: false, comment: 'הערה בלבד' });
  assert.deepEqual(normalizeAnswer({ choices: 'nope' }, q), null);
});

test('toggleMultiChoice: סימון וביטול, "לא החלטנו" מוציא את השאר ולהפך, "אחר", אפשרות בלעדית, לא משנה את המקור', () => {
  const q = { id: 'm', kind: 'multi', options_he: ['a', 'b', 'c', 'none'], allowOther: true, exclusive: [3] };
  let a = toggleMultiChoice(q, null, 2);
  a = toggleMultiChoice(q, a, 0);
  assert.deepEqual(a.choices, [0, 2]);
  const before = JSON.stringify(a);
  const a2 = toggleMultiChoice(q, a, 0);
  assert.deepEqual(a2.choices, [2]);
  assert.equal(JSON.stringify(a), before, 'לא משנה את הקיים');
  const withOther = toggleMultiChoice(q, a, OTHER);
  assert.equal(withOther.other, true);
  assert.equal(toggleMultiChoice(q, withOther, OTHER).other, false);
  const undec = toggleMultiChoice(q, withOther, UNDECIDED);
  assert.deepEqual([undec.choices, undec.other, undec.undecided], [[], false, true]);
  const back = toggleMultiChoice(q, undec, 1);
  assert.deepEqual([back.choices, back.undecided], [[1], false]);
  assert.equal(toggleMultiChoice(q, undec, UNDECIDED).undecided, false, 'ביטול "לא החלטנו"');
  const none = toggleMultiChoice(q, withOther, 3);
  assert.deepEqual([none.choices, none.other], [[3], false], 'בלעדית מוציאה את השאר');
  assert.deepEqual(toggleMultiChoice(q, none, 1).choices, [1], 'סימון אחר מוציא את הבלעדית');
  assert.deepEqual(toggleMultiChoice(q, none, OTHER).choices, [], 'אחר מוציא את הבלעדית');
  assert.deepEqual(toggleMultiChoice(q, null, 99).choices, [], 'אינדקס לא חוקי');
  assert.equal(toggleMultiChoice({ ...q, allowOther: false }, null, OTHER).other, false);
  assert.equal(isOptionOn(a, 2) && !isOptionOn(a, 1) && !isOptionOn(a, OTHER) && !isOptionOn(a, UNDECIDED), true);
  assert.equal(isOptionOn({ choice: 1 }, 1), true);
  assert.deepEqual(emptyAnswer(q), { choices: [], other: false, otherText: '', undecided: false, comment: '' });
  assert.deepEqual(emptyAnswer({ kind: 'single' }), { choice: null, otherText: '', comment: '' });
});

test('sanitizeAnswers: מזהים לא מוכרים נזרקים, ערכים לא חוקיים נזרקים; אידמפוטנטי; שני הסוגים', () => {
  const s = firstSingle(NEVE); const m = firstMulti(NEVE);
  const raw = { [s.id]: { choice: 1 }, [m.id]: { choices: [0, 99, 1] }, zzz: { choice: 0 }, __proto__x: 1 };
  const clean = sanitizeAnswers(NEVE, raw);
  assert.deepEqual(Object.keys(clean).sort(), [s.id, m.id].sort());
  assert.deepEqual(clean[m.id].choices, [0, 1]);
  assert.deepEqual(sanitizeAnswers(NEVE, clean), clean);
  assert.deepEqual(sanitizeAnswers(NEVE, null), {});
  assert.deepEqual(sanitizeAnswers(NEVE, 'x'), {});
  assert.deepEqual(sanitizeAnswers(NEVE, { [s.id]: { choice: 77 } }), {});
});

test('isAnswered: בחירה/כמה בחירות/לא החלטנו = נענתה; אחר בלי טקסט (גם יחד עם בחירות) = לא', () => {
  assert.equal(isAnswered({ choice: 0 }), true);
  assert.equal(isAnswered({ choice: UNDECIDED }), true);
  assert.equal(isAnswered({ choice: OTHER, otherText: '' }), false);
  assert.equal(isAnswered({ choice: OTHER, otherText: 'כן' }), true);
  assert.equal(isAnswered({ choice: null, comment: 'x' }), false);
  assert.equal(isAnswered(null), false);
  assert.equal(isAnswered({ choices: [1], other: false, undecided: false }), true);
  assert.equal(isAnswered({ choices: [], undecided: true }), true);
  assert.equal(isAnswered({ choices: [], other: true, otherText: 'x' }), true);
  assert.equal(isAnswered({ choices: [], other: true, otherText: '  ' }), false);
  assert.equal(isAnswered({ choices: [1], other: true, otherText: '' }), false, 'אחר מסומן בלי טקסט');
  assert.equal(isAnswered({ choices: [], other: false, undecided: false, comment: 'x' }), false);
});

test('validateSubmission: חסרות תשובות בשני הסוגים, אחר-בלי-טקסט, "לא החלטנו" נחשב (גם במרובת-בחירה), שם חובה', () => {
  const resp = { name: 'דנה', role: 'הנהלה' };
  for (const qn of BOTH) {
    const full = completeAnswers(qn);
    const total = visibleQuestions(qn, full).length;
    const empty = validateSubmission(qn, {}, resp);
    assert.equal(empty.ok, false);
    assert.equal(empty.errors.length, visibleQuestions(qn, {}).length);
    assert.ok(empty.errors.every((e) => e.code === 'missing'));
    assert.equal(validateSubmission(qn, full, resp).ok, true);
    assert.equal(validateSubmission(qn, completeAnswers(qn, 'undecided'), resp).ok, true, 'undecided = נענתה');
    assert.ok(total >= 1);

    const s = firstSingle(qn); const m = firstMulti(qn);
    const sOther = { ...full, [s.id]: mkAnswer(s, { choice: OTHER, otherText: '', comment: 'הערה בלבד' }) };
    assert.deepEqual(validateSubmission(qn, sOther, resp).errors, [{ questionId: s.id, code: 'other_text_missing' }]);
    assert.equal(validateSubmission(qn, { ...full, [s.id]: mkAnswer(s, { choice: OTHER, otherText: 'תשובה' }) }, resp).ok, true);

    const mNone = { ...full, [m.id]: mkAnswer(m, { comment: 'רק הערה' }) };
    assert.ok(validateSubmission(qn, mNone, resp).errors.some((e) => e.questionId === m.id && e.code === 'missing'), 'מרובת-בחירה בלי שום סימון = חסרה');
    const mOtherNoText = { ...full, [m.id]: mkAnswer(m, { choices: [0], other: true, otherText: '  ' }) };
    assert.ok(validateSubmission(qn, mOtherNoText, resp).errors.some((e) => e.questionId === m.id && e.code === 'other_text_missing'), 'אחר מסומן בלי טקסט');
    assert.equal(validateSubmission(qn, { ...full, [m.id]: mkAnswer(m, { other: true, otherText: 'משהו' }) }, resp).ok, true, 'אחר עם טקסט בלבד');
    assert.equal(validateSubmission(qn, { ...full, [m.id]: mkAnswer(m, { choices: [0, 1] }) }, resp).ok, true, 'כמה בחירות');
    assert.equal(validateSubmission(qn, { ...full, [m.id]: mkAnswer(m, { undecided: true }) }, resp).ok, true);

    const noName = validateSubmission(qn, full, { name: '  ', role: '' });
    assert.equal(noName.ok, false);
    assert.equal(noName.nameMissing, true);
    assert.deepEqual(noName.errors, []);
  }
});

test('שאלה מותנית מוסתרת לא נדרשת; כשמוצגת היא נדרשת', () => {
  for (const qn of BOTH) {
    const dep = dependents(qn)[0];
    const c = dep.showIf.questionId;
    const all = completeAnswers(qn);
    const hidden = { ...all, [c]: hidingAnswer(qn, dep) };
    delete hidden[dep.id];
    const hiddenIds = new Set(flattenQuestions(qn).filter((q) => !isQuestionVisible(qn, q, hidden)).map((q) => q.id));
    assert.ok(hiddenIds.has(dep.id));
    assert.ok(!validateSubmission(qn, hidden, { name: 'ד' }).errors.some((e) => e.questionId === dep.id));
    const shown = { ...all, [c]: showingAnswer(qn, dep) };
    delete shown[dep.id];
    assert.ok(validateSubmission(qn, shown, { name: 'ד' }).errors.some((e) => e.questionId === dep.id && e.code === 'missing'));
  }
});

test('computeProgress: סופר רק שאלות גלויות; מרובת-בחירה נספרת כשיש סימון', () => {
  for (const qn of BOTH) {
    const total0 = visibleQuestions(qn, {}).length;
    assert.deepEqual(computeProgress(qn, {}), { answered: 0, total: total0 });
    const s = firstSingle(qn); const m = firstMulti(qn);
    const a = { [s.id]: mkAnswer(s, { choice: UNDECIDED }), [m.id]: mkAnswer(m, { choices: [1] }) };
    const withOther = { ...a, [m.id]: mkAnswer(m, { other: true, otherText: '' }) };
    const p1 = computeProgress(qn, a); const p2 = computeProgress(qn, withOther);
    assert.equal(p1.answered - p2.answered, 1, 'אחר בלי טקסט לא נספר');
    const full = completeAnswers(qn);
    assert.deepEqual(computeProgress(qn, full), { answered: visibleQuestions(qn, full).length, total: visibleQuestions(qn, full).length });
  }
});

test('שליחה חוזרת אידמפוטנטית: אותן תשובות -> אותן תשובות; עדכון בודד משנה רק אותו (גם במרובת-בחירה)', () => {
  for (const qn of BOTH) {
    const first = pruneHidden(qn, sanitizeAnswers(qn, completeAnswers(qn)));
    const again = pruneHidden(qn, sanitizeAnswers(qn, first));
    assert.deepEqual(again, first);
    const m = firstMulti(qn);
    const edited = pruneHidden(qn, sanitizeAnswers(qn, { ...first, [m.id]: mkAnswer(m, { choices: [0, 1] }) }));
    assert.deepEqual(edited[m.id].choices, [0, 1]);
    assert.deepEqual({ ...edited, [m.id]: first[m.id] }, first);
    assert.equal(validateSubmission(qn, edited, { name: 'דנה' }).ok, true);
  }
});

test('normalizeRespondent: חיתוך ורווחים', () => {
  assert.deepEqual(normalizeRespondent({ name: '  דנה  ', role: 'הנהלה\nראשית' }), { name: 'דנה', role: 'הנהלה ראשית' });
  assert.deepEqual(normalizeRespondent(null), { name: '', role: '' });
  assert.equal(normalizeRespondent({ name: 'א'.repeat(500) }).name.length, 120);
});

// ---------------------------------------------------------------------------
// סיכום, טקסט וספירות
// ---------------------------------------------------------------------------
test('answerLabel/answerLines: אפשרות / כמה אפשרויות (שורה לכל אחת) / אחר / לא החלטנו / לא נענתה', () => {
  const s = firstSingle(NEVE); const m = firstMulti(NEVE);
  assert.equal(answerLabel(s, { choice: 0 }), s.options_he[0]);
  assert.equal(answerLabel(s, { choice: OTHER, otherText: 'שלושה ימים' }), 'אחר: שלושה ימים');
  assert.equal(answerLabel(s, { choice: UNDECIDED }), UNDECIDED_LABEL);
  assert.equal(answerLabel(s, null), UNANSWERED_LABEL);
  assert.equal(answerLabel(s, { choice: 42 }), UNANSWERED_LABEL);
  assert.deepEqual(answerLines(m, { choices: [0, 1], other: true, otherText: 'עוד', undecided: false }), [m.options_he[0], m.options_he[1], 'אחר: עוד']);
  assert.equal(answerLabel(m, { choices: [0, 1], other: false }), `${m.options_he[0]}\n${m.options_he[1]}`);
  assert.deepEqual(answerLines(m, { choices: [], undecided: true }), [UNDECIDED_LABEL]);
  assert.deepEqual(answerLines(m, { choices: [], other: false }), [UNANSWERED_LABEL]);
  assert.deepEqual(answerLines(m, null), [UNANSWERED_LABEL]);
});

test('summarize: רק שאלות גלויות, לפי סעיפים; מכיל הערות, סימון multi ושורות', () => {
  for (const qn of BOTH) {
    const s = firstSingle(qn); const m = firstMulti(qn);
    const a = { ...completeAnswers(qn), [s.id]: mkAnswer(s, { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה ראשונה' }), [m.id]: mkAnswer(m, { choices: [0, 1] }) };
    const sum = summarize(qn, a);
    const items = sum.flatMap((x) => x.items);
    assert.equal(items.length, visibleQuestions(qn, a).length);
    const si = items.find((i) => i.id === s.id); const mi = items.find((i) => i.id === m.id);
    assert.equal(si.answerText, 'אחר: שבעה ימים'); assert.equal(si.comment, 'הערה ראשונה'); assert.equal(si.multi, false);
    assert.equal(mi.multi, true); assert.deepEqual(mi.answerLines, [m.options_he[0], m.options_he[1]]); assert.ok(mi.answered);
    assert.ok(items.every((i) => !('source' in i)));
  }
});

test('tallyResponses: כל אפשרות שסומנה נספרת (מרובת-בחירה), לא נענתה, ושאלה מותנית רק למי שהיא גלויה אצלה', () => {
  const qn = NEVE;
  const s = firstSingle(qn); const m = firstMulti(qn);
  const r1 = { answers: { ...completeAnswers(qn), [m.id]: mkAnswer(m, { choices: [0, 1] }) } };
  const r2 = { answers: { [m.id]: mkAnswer(m, { choices: [1], other: true, otherText: 'x' }), [s.id]: mkAnswer(s, { choice: UNDECIDED }) } };
  const r3 = { answers: { [m.id]: mkAnswer(m, { undecided: true }) } };
  const t = tallyResponses(qn, [r1, r2, r3]);
  const tm = t.find((x) => x.id === m.id);
  assert.equal(tm.multi, true);
  assert.equal(tm.total, 3);
  assert.equal(tm.counts.find((c) => c.value === 0).count, 1);
  assert.equal(tm.counts.find((c) => c.value === 1).count, 2);
  assert.equal(tm.counts.find((c) => c.value === OTHER).count, 1);
  assert.equal(tm.counts.find((c) => c.value === UNDECIDED).count, 1);
  assert.equal(tm.unanswered, 0);
  const ts = t.find((x) => x.id === s.id);
  assert.equal(ts.multi, false);
  assert.equal(ts.total, 3);
  assert.equal(ts.unanswered, 1, 'r3 לא ענתה');
  assert.equal(ts.counts.find((c) => c.value === UNDECIDED).count, 1);
  const dep = dependents(qn)[0];
  const td = t.find((x) => x.id === dep.id);
  const seeing = [r1, r2, r3].filter((r) => isQuestionVisible(qn, dep, r.answers)).length;
  assert.equal(td.total, seeing);
});

test('formatIsraelDateTime: שעון ישראל (קיץ/חורף) ותאריך לא תקין', () => {
  assert.equal(formatIsraelDateTime('2026-10-05T21:30:00Z'), '06.10.2026 00:30');
  assert.equal(formatIsraelDateTime('2026-12-01T10:00:00Z'), '01.12.2026 12:00');
  assert.equal(formatIsraelDateTime(null), '');
  assert.equal(formatIsraelDateTime('nope'), '');
});

// ---------------------------------------------------------------------------
// קישורים
// ---------------------------------------------------------------------------
test('resolveSiteOrigin: כותרות בקשה, הגנה מהזרקה, משתנה סביבה, כתובת ידועה', () => {
  assert.equal(resolveSiteOrigin({ forwardedHost: 'gmach-neve-yaakov.vercel.app', forwardedProto: 'https' }), 'https://gmach-neve-yaakov.vercel.app');
  assert.equal(resolveSiteOrigin({ host: 'gemach-app-uyh4-beryl.vercel.app' }), 'https://gemach-app-uyh4-beryl.vercel.app');
  assert.equal(resolveSiteOrigin({ host: 'localhost:3000' }), 'http://localhost:3000');
  assert.equal(resolveSiteOrigin({ forwardedHost: 'a.vercel.app, b.vercel.app', forwardedProto: 'https, http' }), 'https://a.vercel.app');
  assert.equal(resolveSiteOrigin({ forwardedHost: 'evil.com/x"onclick=', envProductionUrl: 'gmach-neve-yaakov.vercel.app' }), 'https://gmach-neve-yaakov.vercel.app');
  assert.equal(resolveSiteOrigin({ envProductionUrl: 'https://gmach-neve-yaakov.vercel.app/' }), 'https://gmach-neve-yaakov.vercel.app');
  assert.equal(resolveSiteOrigin({ orgKey: 'org2' }), KNOWN_SITE_ORIGINS.org2);
  assert.equal(resolveSiteOrigin({}), KNOWN_SITE_ORIGINS.org1);
  assert.equal(KNOWN_SITE_ORIGINS.org1, 'https://gemach-app-uyh4-beryl.vercel.app');
  assert.equal(KNOWN_SITE_ORIGINS.org2, 'https://gmach-neve-yaakov.vercel.app');
  assert.equal(resultsUrl('https://x.app'), 'https://x.app/refund-questionnaire/answers');
  assert.equal(answerUrl('https://x.app'), 'https://x.app/refund-questionnaire');
});

// ---------------------------------------------------------------------------
// המייל
// ---------------------------------------------------------------------------
function sampleResponse(qn) {
  return { respondentName: 'דנה לוי', respondentRole: 'הנהלה ראשית', answers: mailAnswers(qn), submittedAt: '2026-10-05T21:30:00.000Z' };
}

test('קטלוג: policyQuestionnaireSubmitted רשום, קטגוריית הנהלה, נושא לפי הנוסח', () => {
  const e = EMAIL_CATALOG.policyQuestionnaireSubmitted;
  assert.ok(e);
  assert.equal(e.category, 'management');
  assert.equal(e.template, 'renderPolicyQuestionnaireEmailHtml');
  assert.equal(e.logged, true);
  assert.ok(e.recipients.includes('roleId=2'));
  assert.equal(emailSubject('policyQuestionnaireSubmitted', { gmachName: 'נווה יעקב', respondentName: 'דנה לוי' }), 'שאלון מדיניות ביטולים וזיכויים - נווה יעקב - דנה לוי');
  assert.equal(emailSubject('policyQuestionnaireSubmitted', { gmachName: 'מכובד', respondentName: 'רחלי', updated: true }), 'שאלון מדיניות ביטולים וזיכויים - מכובד - רחלי (עודכן)');
  assert.equal(Object.keys(EMAIL_CATALOG).length, 17);
  for (const f of e.source) assert.ok(existsSync(path.join(root, f)), `source file missing: ${f}`);
});

test('מייל: נושא, גוף טקסט ו-HTML מכילים את כל התשובות (כל אפשרות מרובת-בחירה בשורה), אחר, הערות והקישור המלא', () => {
  for (const [qn, origin] of [[NEVE, 'https://gmach-neve-yaakov.vercel.app'], [MAIN, 'https://gemach-app-uyh4-beryl.vercel.app']]) {
    const response = sampleResponse(qn);
    const mail = buildQuestionnaireEmail({ qn, response, updated: false, origin });
    assert.equal(mail.subject, `שאלון מדיניות ביטולים וזיכויים - ${qn.gmachName} - דנה לוי`);
    const link = `${origin}/refund-questionnaire/answers`;
    assert.equal(mail.resultsUrl, link);
    assert.ok(mail.body.includes(link) && mail.html.includes(link));
    assert.ok(mail.body.includes(`${origin}/refund-questionnaire`));
    for (const q of visibleQuestions(qn, response.answers)) {
      assert.ok(mail.body.includes(q.text_he), `body question ${q.id}`);
      assert.ok(mail.html.includes(escapeHtml(q.text_he)), `html question ${q.id}`);
      for (const line of answerLines(q, response.answers[q.id])) {
        assert.ok(mail.body.includes(line), `body answer ${q.id}`);
        assert.ok(mail.html.includes(escapeHtml(line)), `html answer ${q.id}`);
      }
    }
    const m = visibleQuestions(qn, response.answers).find((q) => isMulti(q));
    assert.ok(mail.body.includes(`• ${m.options_he[0]}\n   • ${m.options_he[1]}`), 'בגוף הטקסט: שורה לכל אפשרות');
    assert.ok(mail.html.includes(`• ${escapeHtml(m.options_he[0])}<br>• ${escapeHtml(m.options_he[1])}`), 'ב-HTML: שורה לכל אפשרות');
    assert.ok(mail.body.includes('הערה: הערה "חשובה" לשאלה'));
    assert.ok(mail.html.includes(escapeHtml('הערה "חשובה" לשאלה')));
    assert.ok(mail.html.includes(escapeHtml('שלושה ימים <b>מהאירוע</b> & עוד')) && mail.html.includes(escapeHtml('סיבה <i>נוספת</i>')), 'טקסט אחר מוצמד ב-escape');
    assert.ok(!mail.html.includes('<b>מהאירוע</b>') && !mail.html.includes('<i>נוספת</i>'), 'אין HTML גולמי מהמשיבה');
    assert.ok(mail.body.includes('דנה לוי') && mail.body.includes('הנהלה ראשית'));
    assert.ok(mail.html.includes('06.10.2026 00:30'));
    assert.ok(!/<script/i.test(mail.html));
    assert.ok(!mail.html.includes('עודכן'), 'שליחה ראשונה בלי תגית עודכן');
    assert.ok(!mail.body.includes('עדכון - זו גרסה'));
    assert.ok(mail.body.includes('שרשור "📋 שאלון מדיניות ביטולים וזיכויים"'), 'מזכיר שהתשובות גם בשרשור');
  }
});

test('מייל "עודכן": נושא עם (עודכן), גוף ו-HTML מסומנים', () => {
  const mail = buildQuestionnaireEmail({ qn: NEVE, response: sampleResponse(NEVE), updated: true, origin: 'https://gmach-neve-yaakov.vercel.app' });
  assert.ok(mail.subject.endsWith(' (עודכן)'));
  assert.ok(mail.body.includes('עדכון - זו גרסה מעודכנת'));
  assert.ok(mail.html.includes('עודכן'));
});

test('מייל: RTL מוטמע (dir ו-direction) ושפה עברית', () => {
  const { html } = buildQuestionnaireEmail({ qn: NEVE, response: sampleResponse(NEVE), updated: false, origin: 'https://x.vercel.app' });
  assert.ok(html.includes('<html dir="rtl" lang="he">'));
  assert.ok(html.includes('direction:rtl;text-align:right'));
  assert.ok((html.match(/<table(?![^>]*dir="rtl")/g) || []).length === 0, 'כל טבלה עם dir=rtl');
  assert.ok((html.match(/dir="rtl"/g) || []).length >= 15);
});

test('מייל: שאלה מותנית מוסתרת לא נשלחת במייל', () => {
  const dep = dependents(NEVE)[0];
  const response = sampleResponse(NEVE);
  response.answers[dep.showIf.questionId] = hidingAnswer(NEVE, dep);
  response.answers[dep.id] = mkAnswer(dep, { choice: 0 });
  const mail = buildQuestionnaireEmail({ qn: NEVE, response, updated: false, origin: 'https://x.vercel.app' });
  assert.ok(!mail.body.includes(dep.text_he));
});

// ---------------------------------------------------------------------------
// השרשור: הדפסת התשובות לטקסט של תגובה, פענוח חזרה, וקיבוץ לפי משיבה
// ---------------------------------------------------------------------------
/** תשובות מגוונות לכל השאלות: אפשרות, האחרונה, לא החלטנו, אחר; ובמרובת-בחירה: כמה, הכול, אחר+בחירות, אחר בלבד, לא החלטנו. */
function variedAnswers(qn) {
  const out = {};
  flattenQuestions(qn).forEach((q, i) => {
    const n = q.options_he.length;
    const k = i % 5;
    const comment = i % 3 === 0 ? `הערה ל-${q.id}` : '';
    if (isMulti(q)) {
      const ex = new Set(q.exclusive || []);
      const normal = q.options_he.map((_, j) => j).filter((j) => !ex.has(j));
      out[q.id] = k === 0 ? mkAnswer(q, { choices: [pickIndex(qn, q)], comment })
        : k === 1 ? mkAnswer(q, { choices: [normal[0], normal[normal.length - 1]], comment })
          : k === 2 ? mkAnswer(q, { undecided: true, comment })
            : k === 3 ? mkAnswer(q, { choices: [normal[0]], other: true, otherText: `פירוט ${q.id}\nשורה שנייה`, comment })
              : mkAnswer(q, { other: true, otherText: `רק אחר ${q.id}`, comment });
    } else {
      out[q.id] = k === 0 ? mkAnswer(q, { choice: pickIndex(qn, q), comment })
        : k === 1 ? mkAnswer(q, { choice: n - 1, comment })
          : k === 2 ? mkAnswer(q, { choice: UNDECIDED, comment })
            : mkAnswer(q, { choice: OTHER, otherText: `פירוט ${q.id}`, comment });
    }
  });
  return out;
}

test('שרשור: הדפסה ופענוח הלוך-חזור על תשובות מגוונות בשני הגמחים (אפשרות, כמה אפשרויות, אחר, לא החלטנו, הערה)', () => {
  for (const qn of BOTH) {
    const answers = pruneHidden(qn, sanitizeAnswers(qn, variedAnswers(qn)));
    const text = renderSubmissionText(qn, answers, { respondentName: 'דנה לוי', respondentRole: 'הנהלה ראשית', submittedAt: '2026-10-05T21:30:00Z', updated: false });
    const parsed = parseSubmissionText(qn, text);
    assert.deepEqual(parsed.answers, answers, `${qn.orgKey} round trip`);
    assert.deepEqual(parsed.unparsed, []);
    assert.equal(parsed.respondentName, 'דנה לוי');
    assert.equal(parsed.respondentRole, 'הנהלה ראשית');
    assert.equal(parsed.updated, false);
    assert.equal(parsed.sentAtText, '06.10.2026 00:30');
    for (const q of visibleQuestions(qn, answers)) {
      assert.ok(text.includes(`${q.id} ${q.text_he}`), `question ${q.id}`);
      if (answers[q.id].comment) assert.ok(text.includes(`הערה: ${answers[q.id].comment}`), `comment ${q.id}`);
      if (isMulti(q) && answers[q.id].choices.length) for (const c of answers[q.id].choices) assert.ok(text.includes(`• ${q.options_he[c]}`), `${q.id} bullet`);
    }
  }
});

test('שרשור: כל אפשרות של כל שאלה לבדה, וכל האפשרויות יחד במרובת-בחירה (כולל אחר ולא החלטנו) נפענחות בחזרה בדיוק', () => {
  for (const qn of BOTH) {
    for (const q of flattenQuestions(qn)) {
      const cases = [];
      for (const o of optionsForQuestion(q)) {
        if (isMulti(q)) cases.push(o.kind === 'other' ? mkAnswer(q, { other: true, otherText: 'טקסט אחר' }) : o.kind === 'undecided' ? mkAnswer(q, { undecided: true }) : mkAnswer(q, { choices: [o.value] }));
        else cases.push(mkAnswer(q, { choice: o.value, otherText: o.kind === 'other' ? 'טקסט אחר' : '' }));
      }
      if (isMulti(q)) {
        const ex = new Set(q.exclusive || []);
        cases.push(mkAnswer(q, { choices: q.options_he.map((_, j) => j).filter((j) => !ex.has(j)), other: true, otherText: 'ועוד' }));
      }
      for (const a0 of cases) {
        const a = normalizeAnswer(a0, q);
        const text = renderSubmissionText(qn, { [q.id]: a }, { respondentName: 'א' });
        if (!isQuestionVisible(qn, q, { [q.id]: a })) continue;
        assert.deepEqual(parseSubmissionText(qn, text).answers[q.id], a, `${q.id} ${JSON.stringify(a)}`);
      }
    }
  }
});

test('שרשור: טקסט רב-שורתי ב"אחר" ובהערה (שורה ריקה, שורה שנראית כמו שאלה/תשובה/אפשרות) נשמר, גם במרובת-בחירה; שאלה מוסתרת לא נכתבת', () => {
  for (const qn of BOTH) {
    const s = firstSingle(qn); const m = firstMulti(qn);
    const nasty = 'הערה א\n\n' + `${m.id} זה לא שאלה\nתשובה: גם זה לא\n• ולא אפשרות\n  ועוד`;
    const answers = {
      [s.id]: mkAnswer(s, { choice: OTHER, otherText: 'שורה א\nשורה ב', comment: nasty }),
      [m.id]: mkAnswer(m, { choices: [0], other: true, otherText: `שורה א\n\n• שורה שנראית כאפשרות\n${s.id} וגם כשאלה`, comment: nasty }),
    };
    const pruned = pruneHidden(qn, sanitizeAnswers(qn, answers));
    const text = renderSubmissionText(qn, pruned, { respondentName: 'דנה' });
    const p = parseSubmissionText(qn, text);
    assert.deepEqual(p.answers[s.id], pruned[s.id]);
    assert.deepEqual(p.answers[m.id], pruned[m.id]);
    assert.deepEqual(p.unparsed, []);
  }
  const dep = dependents(NEVE)[0];
  const a = { ...completeAnswers(NEVE), [dep.showIf.questionId]: hidingAnswer(NEVE, dep), [dep.id]: mkAnswer(dep, { choice: 0 }) };
  const text = renderSubmissionText(NEVE, pruneHidden(NEVE, a), { respondentName: 'דנה' });
  assert.ok(!text.includes(`${dep.id} ${dep.text_he}`), 'מותנית מוסתרת לא נכתבת');
  assert.ok(!('${dep.id}' in parseSubmissionText(NEVE, text).answers));
});

test('שרשור: שליחה חוזרת מסומנת "עדכון"; שליחה ראשונה לא; הכותרת מזהה תגובת תשובות', () => {
  const a = completeAnswers(NEVE);
  const first = renderSubmissionText(NEVE, a, { respondentName: 'דנה', updated: false });
  const second = renderSubmissionText(NEVE, a, { respondentName: 'דנה', updated: true });
  assert.ok(first.startsWith(`${THREAD_TITLE} - נווה יעקב\n`));
  assert.ok(!first.includes('עדכון'));
  assert.ok(second.split('\n')[1].startsWith('עדכון'));
  assert.equal(parseSubmissionText(NEVE, first).updated, false);
  assert.equal(parseSubmissionText(NEVE, second).updated, true);
  assert.equal(isSubmissionText(first), true);
  assert.equal(isSubmissionText('תגובה חופשית של מתכנת'), false);
  assert.equal(isSubmissionText(''), false);
  assert.equal(parseSubmissionText(NEVE, 'תגובה חופשית'), null);
});

test('שרשור: נוסח שלא מזוהה (אחרי שינוי נוסח אפשרות) מדווח ב-unparsed ולא נכנס לתשובות - בשני הסוגים, גם כשרק פריט אחד שונה', () => {
  const qn = NEVE;
  const s = firstSingle(qn); const m = firstMulti(qn);
  const a = { ...completeAnswers(qn), [s.id]: mkAnswer(s, { choice: 0 }), [m.id]: mkAnswer(m, { choices: [0, 1] }) };
  const text = renderSubmissionText(qn, a, { respondentName: 'דנה' });
  const t1 = text.replace(`תשובה: ${s.options_he[0]}`, 'תשובה: נוסח שלא קיים במאגר');
  const p1 = parseSubmissionText(qn, t1);
  assert.ok(p1.unparsed.includes(s.id) && !(s.id in p1.answers));
  const t2 = text.replace(`• ${m.options_he[1]}`, '• נוסח ישן של אפשרות');
  const p2 = parseSubmissionText(qn, t2);
  assert.deepEqual(p2.unparsed, [m.id]);
  assert.ok(!(m.id in p2.answers));
  assert.ok(Object.keys(p2.answers).length === Object.keys(a).length - 1, 'שאר התשובות נטענו');
  const t3 = text.replace(`תשובה: • ${m.options_he[0]}`, `תשובה: ${m.options_he[0]}`);
  assert.deepEqual(parseSubmissionText(qn, t3).unparsed, [m.id], 'שורה בלי תבליט במרובת-בחירה לא מזוהה');
});

test('שרשור: threadMarker, כותרת קבועה ותוכן פותח', () => {
  assert.equal(THREAD_TITLE, '📋 שאלון מדיניות ביטולים וזיכויים');
  assert.equal(threadMarker(QUESTIONNAIRE_KEY), 'policy-questionnaire:refunds-2026-10b');
  assert.notEqual(threadMarker('refunds-2027-01'), threadMarker(QUESTIONNAIRE_KEY));
  const intro = buildThreadIntro(NEVE);
  assert.ok(intro.startsWith(THREAD_TITLE) && intro.includes('נווה יעקב') && intro.includes('/refund-questionnaire/answers') && intro.includes('עדכון'));
});

test('groupSubmissions: לפי משיבה, האחרונה במלואה + גרסאות קודמות מהחדשה לישנה, מדלג על תגובות חופשיות, החדשה ראשונה (כולל מרובת-בחירה)', () => {
  const m = firstMulti(NEVE);
  const mk = (id, employeeId, createdAt, o = {}) => ({
    id, employeeId, employeeName: o.employeeName || '', createdAt,
    text: o.text || renderSubmissionText(NEVE, o.answers || completeAnswers(NEVE), { respondentName: o.name || 'דנה', respondentRole: 'הנהלה', submittedAt: createdAt, updated: !!o.updated }),
  });
  const replies = [
    mk('r3', 'e1', '2026-10-06T10:00:00Z', { updated: true, answers: { ...completeAnswers(NEVE), [m.id]: mkAnswer(m, { choices: [0, 1] }) } }),
    mk('r1', 'e1', '2026-10-06T08:00:00Z'),
    mk('r2', 'e2', '2026-10-06T09:00:00Z', { name: 'רבקה' }),
    { id: 'free', employeeId: 'e2', employeeName: 'רבקה', createdAt: '2026-10-06T11:00:00Z', text: 'שאלה חופשית מהמתכנת' },
    mk('r4', null, '2026-10-06T07:00:00Z', { name: 'ללא מזהה' }),
  ];
  const groups = groupSubmissions(NEVE, replies);
  assert.deepEqual(groups.map((g) => g.name), ['דנה', 'רבקה', 'ללא מזהה']);
  const d = groups[0];
  assert.equal(d.count, 2);
  assert.equal(d.latest.id, 'r3');
  assert.equal(d.latest.updated, true);
  assert.deepEqual(d.latest.answers[m.id].choices, [0, 1]);
  assert.deepEqual(d.earlier.map((e) => e.id), ['r1']);
  assert.equal(groups[1].count, 1, 'תגובה חופשית לא נספרת');
  assert.deepEqual(groupSubmissions(NEVE, []), []);
  assert.deepEqual(groupSubmissions(NEVE, null), []);
  const tally = tallyResponses(NEVE, groups.map((g) => g.latest));
  assert.equal(tally.find((t) => t.id === m.id).counts.find((c) => c.value === 1).count, 1);
  assert.equal(joinSubmissionTexts(['א', '', 'ב']), 'א\n\n------------------------------\n\nב');
});

test('classifyDbError: התעוררות / אחר', () => {
  assert.equal(classifyDbError({ code: 'P1001' }), 'transient');
  assert.equal(classifyDbError({ code: 'P2024' }), 'transient');
  assert.equal(classifyDbError({ message: "Can't reach database server at ep-x.neon.tech" }), 'transient');
  assert.equal(classifyDbError({ message: 'syntax error at or near "FROM"' }), 'other');
  assert.equal(classifyDbError({ code: 'P2021' }), 'other');
  assert.equal(classifyDbError(null), 'other');
});

// ---------------------------------------------------------------------------
// אין טבלה / סכימה / DDL (החלטת הבעלים 2026-10-06: התשובות בשרשור דיווח-תקלה)
// ---------------------------------------------------------------------------
const FEATURE_DIRS = ['lib/policyQuestionnaire', 'app/api/policy-questionnaire', 'app/refund-questionnaire'];
function featureFiles() {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(path.join(root, rel))) {
      const r = `${rel}/${name}`;
      if (statSync(path.join(root, r)).isDirectory()) walk(r); else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(r);
    }
  };
  FEATURE_DIRS.forEach(walk);
  return out;
}
const DDL_RE = /\b(?:CREATE|ALTER|DROP|TRUNCATE|RENAME)\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TABLE|INDEX|SCHEMA|DATABASE|COLUMN|VIEW|TYPE|EXTENSION|CONSTRAINT|SEQUENCE|FUNCTION|TRIGGER)\b/i;

test('אין DDL ואין SQL גולמי בשום קובץ של הפיצ\'ר (כולל מאגר השאלות), וה-store כותב רק דרך prisma.errorReport / prisma.errorReportReply', () => {
  const files = featureFiles();
  assert.ok(files.length >= 13, `נמצאו ${files.length} קבצים`);
  assert.ok(files.includes('lib/policyQuestionnaire/common-bank.js'));
  for (const f of files) {
    const s = src(f);
    assert.ok(!DDL_RE.test(s), `${f}: מכיל משפט DDL`);
    assert.ok(!/ensureTable|createTable|tableReady|CREATE TABLE/i.test(s), `${f}: שאריות יצירה עצלנית`);
    assert.ok(!/\$executeRaw|\$queryRaw/.test(s), `${f}: SQL גולמי`);
    assert.ok(!/\$transaction\(/.test(s), `${f}: $transaction`);
    assert.ok(!/PolicyQuestionnaireResponse|policyQuestionnaireResponse|not_enabled|NotEnabled/.test(s), `${f}: שארית של הטבלה`);
  }
  for (const bad of ['CREATE TABLE IF NOT EXISTS "X" (id int)', 'create unique index i on t(a)', 'ALTER TABLE "X" ADD COLUMN y int', 'DROP TABLE "X"']) assert.ok(DDL_RE.test(bad), bad);
  const store = src('lib/policyQuestionnaire/store.js');
  assert.ok(store.includes('prisma.errorReport.create') && store.includes('prisma.errorReportReply.create') && store.includes('prisma.errorReport.update'));
  assert.ok(!/auditLog/i.test(store.replace(/\/\/.*$/gm, '')), 'אין כתיבת AuditLog ידנית');
  assert.ok(store.includes('@/app/lib/prisma'), 'הלקוח המשותף (עם תוסף ה-AuditLog)');
});

test('אין שום שאריות של הטבלה: סכימה, תוסף ה-AuditLog, SQL ממתין, סקריפט הרצה, SQLite והסנכרון הלא מקוון', () => {
  for (const f of ['prisma/schema.prisma', 'prisma/schema.local.prisma', 'prisma/schema-sqlite.prisma', 'app/lib/prisma.js', 'lib/offlineSync.js']) {
    if (!existsSync(path.join(root, f))) continue;
    assert.ok(!/PolicyQuestionnaire|policyQuestionnaire/.test(src(f)), `${f}: שארית של שאלון המדיניות`);
  }
  const pending = path.join(root, 'prisma/migrations-pending');
  if (existsSync(pending)) assert.deepEqual(readdirSync(pending).filter((n) => /questionnaire/i.test(n)), [], 'אין SQL ממתין לשאלון');
  assert.ok(!existsSync(path.join(root, 'scripts/apply_policy_questionnaire_table.js')));
  assert.ok(!existsSync(path.join(root, 'app/refund-questionnaire/NotEnabled.js')));
  for (const f of ['CLAUDE.md', 'docs/refund-questionnaire.md']) {
    const s = src(f).split('\n').filter((l) => /questionnaire|שאלון/i.test(l)).join('\n');
    assert.ok(!/apply_policy_questionnaire_table|migrations-pending\/2026-10-06-policy|CREATE TABLE/.test(s), `${f}: תיעוד של הטבלה הישנה`);
  }
});

test('מייל: מסלול התגובה הרגיל לא שולח מייל, ולכן מייל השאלון הוא היחיד (מסלול אחד, פעם אחת בשליחה, בלי כפילות)', () => {
  const reply = src('app/api/error-report/reply/route.js');
  assert.ok(!/sendSystemEmail|mailer|sendProgrammerEmail|emailTemplates/.test(reply), 'אם זה ישתנה - יש להסיר את מייל השאלון (ר\' docs/refund-questionnaire.md, "המייל לבעלים")');
  const senders = featureFiles().filter((f) => /sendSystemEmail/.test(src(f)));
  assert.deepEqual(senders, ['lib/policyQuestionnaire/notify.js']);
  assert.ok(!/mailer|sendQuestionnaireEmail/.test(src('lib/policyQuestionnaire/store.js')));
  assert.equal((src('app/api/policy-questionnaire/route.js').match(/sendQuestionnaireEmail\(/g) || []).length, 1, 'POST שולח פעם אחת');
  assert.ok(!/sendQuestionnaireEmail/.test(src('app/api/policy-questionnaire/answers/route.js')));
  for (const f of featureFiles()) assert.ok(!/api\/error-report|repository_dispatch|GH_DISPATCH/.test(src(f).replace(/\/\/.*$/gm, '')), f);
  const md = src('docs/refund-questionnaire.md');
  assert.ok(md.includes('המייל האוטומטי היחיד') && md.includes('לא שולח שום מייל'));
  assert.ok(src('EMAILS.md').includes('policyQuestionnaireSubmitted'));
});

test('נראות השרשור בחלון הדיווחים (כפי שנקרא בקוד): מתכנת רואה הכול, אחרים רק דיווחים על שמם', () => {
  const list = src('app/api/error-report/route.js');
  assert.ok(list.includes('const isProgrammer = employee.roleId === 2;') && list.includes('const whereClause = isProgrammer ? {} : { employeeId: employee.id };'),
    'אם כללי הנראות ישתנו - לעדכן את docs/refund-questionnaire.md, "מי יכולה לענות ומי רואה"');
  const store = src('lib/policyQuestionnaire/store.js');
  assert.ok(/employeeId,\s+time:/.test(store), 'השרשור נפתח על שם מי ששלחה ראשונה');
});

test('הרשאות וחיווט: ה-API מחייב הנהלה ראשית/מתכנת, לא סומך על employeeId מהלקוח, בלי PUT ובלי שמירה אוטומטית בשרת', () => {
  for (const f of ['app/api/policy-questionnaire/route.js', 'app/api/policy-questionnaire/resend/route.js', 'app/api/policy-questionnaire/answers/route.js']) {
    const s = src(f);
    assert.ok(s.includes('requireHeadManagement'), f);
    assert.ok(!/body\.employeeId|body\.employee\b|searchParams/.test(s), `${f}: מזהה מהלקוח`);
  }
  const route = src('app/api/policy-questionnaire/route.js');
  assert.ok(/export async function GET/.test(route) && /export async function POST/.test(route) && !/export async function (PUT|PATCH|DELETE)/.test(route));
  const access = src('lib/policyQuestionnaire/access.js');
  assert.ok(access.includes("checkAuth('הנהלה ראשית')") && access.includes('getSessionEmployee') && access.includes('HEAD_MANAGEMENT_ROLES'));
  assert.ok(route.includes('validateSubmission') && route.includes('emailSent'));
  const layout = src('app/refund-questionnaire/layout.js');
  assert.ok(layout.includes('checkPageAccess(HEAD_MANAGEMENT_ROLES)') && layout.includes('NoAccessMessage') && layout.includes('./refund-questionnaire.css'));
  assert.ok(src('app/refund-questionnaire/answers/page.js').includes('requireHeadManagement({ page: true })'), 'דף שרת בלי checkAuth (לא ניתן לכתוב עוגיות מדף)');
  assert.ok(src('lib/menu/pageLabels.js').includes("'/refund-questionnaire': 'שאלון ביטולים וזיכויים'") && src('lib/menu/pageLabels.js').includes("'/refund-questionnaire/answers': 'תשובות שאלון ביטולים וזיכויים'"));
});

test('חיווט הטופס: RTL, רדיו לבחירה-אחת ותיבות סימון למרובת-בחירה, רמזים, טיוטה בדפדפן בלבד, אישור שליחה, עדכון וניסיון חוזר למייל', () => {
  const c = src('app/refund-questionnaire/RefundQuestionnaireClient.js');
  assert.ok((c.match(/dir="rtl"/g) || []).length >= 4);
  assert.ok(c.includes('type="checkbox"') && c.includes('type="radio"') && c.includes('selectionHint') && c.includes('toggleMultiChoice') && c.includes('toggleAnswer'));
  assert.ok(c.includes('ענית על') && c.includes('לשלוח את התשובות?') && c.includes('עדכון התשובות'));
  assert.ok(c.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב') && c.includes('/resend'));
  assert.ok(c.includes('הטיוטה נשמרת רק בדפדפן הזה עד השליחה'));
  assert.ok(!/method:\s*'PUT'|'PUT'/.test(c), 'אין שמירה אוטומטית בשרת');
  assert.ok(c.includes('lib/policyQuestionnaire/draft'));
  assert.ok(c.includes('דוגמה') && c.includes('לידיעה בלבד'));
  assert.ok(!/\.source(?![A-Za-z])|"source"|sourceNote|למה שואלים/.test(c), 'הקליינט לא נוגע ב-source');
  const draft = src('lib/policyQuestionnaire/draft.js');
  const fnBodies = draft.split('export function').slice(1);
  for (const body of fnBodies.filter((b) => !b.startsWith(' draftKey'))) assert.ok(/try \{/.test(body), 'כל גישה לאחסון בתוך try/catch');
  const a = src('app/refund-questionnaire/answers/AnswersClient.js');
  assert.ok(a.includes('dir="rtl"') && a.includes('העתק הכל') && a.includes('window.print') && a.includes('print-hide') && a.includes('גרסאות קודמות') && a.includes('<details'));
  assert.ok(!/q\.source|sourceById|מקור:/.test(a));
});

test('חיווט: דוגמת מייל קיימת ב-emailSamples ושורה 17 ב-EMAILS.md; הקטלוג מפרט שהוא המייל היחיד', () => {
  assert.ok(src('lib/emailSamples.js').includes("case 'policyQuestionnaireSubmitted'"));
  const md = src('EMAILS.md');
  assert.ok(md.includes('policyQuestionnaireSubmitted') && md.includes('טבלת כל המיילים (17)'));
  assert.ok(EMAIL_CATALOG.policyQuestionnaireSubmitted.trigger.includes('המייל היחיד'));
});

test('תיעוד: docs/refund-questionnaire.md כולל את ארבעת הקישורים המלאים, שאלון משותף, איפה התשובות נשמרות, מי רואה, וההושמטים; CLAUDE.md מצביע עליו', () => {
  const d = src('docs/refund-questionnaire.md');
  for (const u of [
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire',
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire/answers',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers',
  ]) assert.ok(d.includes(u), u);
  for (const o of OMITTED_TOPICS) assert.ok(d.includes(o.topic_he), o.topic_he.slice(0, 30));
  assert.ok(d.includes(`${flattenQuestions(MAIN).length} שאלות`), 'מספר השאלות מעודכן');
  assert.ok(d.includes('אותן שאלות') && d.includes('מבחן אמריקאי') && d.includes('אפשר לסמן כמה') && d.includes('today_he'));
  assert.ok(d.includes('שרשור דיווח-תקלה אחד לכל גמ"ח') && d.includes('בלי טבלה חדשה, בלי שינוי סכימה ובלי DDL'));
  assert.ok(d.includes('policy-questionnaire:refunds-2026-10b') && d.includes('needsHuman = true') && d.includes('עדכון') && d.includes('localStorage'));
  assert.ok(d.includes('מי יכולה לענות ומי רואה') && d.includes('מנהלות רגילות'));
  assert.ok(!/אביגיל|אהובה|רחלי|יוסי/.test(d), 'אין שמות עובדות במסמך');
  assert.ok(src('CLAUDE.md').includes('docs/refund-questionnaire.md'));
  assert.ok(src('CLAUDE.md').includes('There is no table, no schema change and no DDL'));
});

// ---------------------------------------------------------------------------
// טיוטות בדפדפן (localStorage מדומה)
// ---------------------------------------------------------------------------
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
}
test('טיוטה: מפתח לפי שאלון ועובדת; שמירה, טעינה (עם ניקוי מול השאלון, כולל מרובת-בחירה) ומחיקה', () => {
  assert.equal(draftKey(QUESTIONNAIRE_KEY, 'emp-1'), 'rq-draft:refunds-2026-10b:emp-1');
  assert.notEqual(draftKey(QUESTIONNAIRE_KEY, 'emp-1'), draftKey(QUESTIONNAIRE_KEY, 'emp-2'));
  const s = firstSingle(NEVE); const m = firstMulti(NEVE);
  const st = fakeStorage();
  const key = draftKey(QUESTIONNAIRE_KEY, 'emp-1');
  assert.equal(loadDraft(st, key, NEVE), null, 'אין טיוטה');
  const draftAnswers = { [s.id]: { choice: 1, otherText: '', comment: 'א' }, [m.id]: { choices: [1, 0, 99], other: true, otherText: 'ב', undecided: false, comment: '' }, bogus: { choice: 0 } };
  assert.equal(saveDraft(st, key, { answers: draftAnswers, name: ' דנה ', role: 'הנהלה' }, 12345), true);
  const d = loadDraft(st, key, NEVE);
  assert.deepEqual(d.answers, { [s.id]: { choice: 1, otherText: '', comment: 'א' }, [m.id]: { choices: [0, 1], other: true, otherText: 'ב', undecided: false, comment: '' } }, 'מזהה לא מוכר ואינדקס לא חוקי נזרקים');
  assert.equal(d.name, 'דנה');
  assert.equal(d.role, 'הנהלה');
  assert.equal(d.savedAt, 12345);
  assert.equal(clearDraft(st, key), true);
  assert.equal(loadDraft(st, key, NEVE), null);
  assert.equal(st._m.size, 0);
});

test('טיוטה: הדף עובד בלי אחסון - אחסון חסום/זורק/ריק/פגום/גרסה אחרת לא זורקים ומחזירים ברירת מחדל', () => {
  const key = draftKey(QUESTIONNAIRE_KEY, 'emp-1');
  const s = firstSingle(NEVE);
  const thrower = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };
  assert.equal(saveDraft(thrower, key, { answers: {} }), false);
  assert.equal(loadDraft(thrower, key, NEVE), null);
  assert.equal(clearDraft(thrower, key), false);
  assert.equal(saveDraft(null, key, { answers: {} }), false);
  assert.equal(loadDraft(null, key, NEVE), null);
  assert.equal(clearDraft(undefined, key), false);
  const st = fakeStorage();
  st.setItem(key, '{not json');
  assert.equal(loadDraft(st, key, NEVE), null);
  st.setItem(key, JSON.stringify({ v: 99, answers: { [s.id]: { choice: 0 } } }));
  assert.equal(loadDraft(st, key, NEVE), null, 'גרסה אחרת');
  st.setItem(key, JSON.stringify({ v: 1, answers: {}, name: '', role: '' }));
  assert.equal(loadDraft(st, key, NEVE), null, 'טיוטה ריקה');
  assert.equal(browserStorage(), null, 'ב-node אין window');
});

// ---------------------------------------------------------------------------
// עזרים לבדיקות עם Prisma מדומה: שרשור בזיכרון (ErrorReport + ErrorReportReply). אין DB, אין רשת, אין שליחת מייל אמיתית.
// ---------------------------------------------------------------------------
async function withTsHooks(stubs, fn) {
  const req = createRequire(path.join(root, 'package.json'));
  let ts; let Module;
  try { ts = req('typescript'); Module = req('node:module'); } catch {
    console.log('SKIP (typescript לא זמין - הגדירו NODE_PATH ל-node_modules)');
    return false;
  }
  const origResolve = Module._resolveFilename;
  const origLoad = Module._load;
  const origJs = Module._extensions['.js'];
  const rootNorm = root.split(path.sep).join('/');
  Module._load = function patchedLoad(request, ...rest) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return origLoad.call(this, request, ...rest);
  };
  Module._resolveFilename = function patchedResolve(request, ...rest) {
    if (typeof request === 'string' && request.startsWith('@/') && !Object.prototype.hasOwnProperty.call(stubs, request)) request = path.join(root, request.slice(2));
    return origResolve.call(this, request, ...rest);
  };
  Module._extensions['.js'] = function hook(module, filename) {
    const norm = filename.split(path.sep).join('/');
    if (norm.startsWith(rootNorm) && !norm.includes('/node_modules/')) {
      const out = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename.replace(/\.js$/, '.jsx'), compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
      module._compile(out.outputText, filename);
      return;
    }
    origJs(module, filename);
  };
  const clearCache = () => {
    for (const k of Object.keys(Module._cache)) {
      const n = k.split(path.sep).join('/');
      if (n.startsWith(rootNorm) && !n.includes('/node_modules/')) delete Module._cache[k];
    }
  };
  clearCache(); // כל בדיקה טוענת את מודולי הפיצ'ר מחדש מול ה-Prisma המדומה שלה
  try { await fn(req); } finally {
    clearCache();
    Module._resolveFilename = origResolve;
    Module._load = origLoad;
    Module._extensions['.js'] = origJs;
  }
  return true;
}

function makeFakePrisma() {
  const state = { reports: [], replies: [], clock: 0, seq: 0, ops: [], failNext: null, owners: [], employees: {} };
  const now = () => new Date(Date.UTC(2026, 9, 6, 8, 0, 0) + (state.clock += 1000));
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'startsWith' in v) return String(row[k] ?? '').startsWith(v.startsWith);
    return row[k] === v;
  });
  const sortBy = (rows, orderBy) => {
    if (!orderBy) return rows;
    const [[k, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (dir === 'desc' ? -1 : 1) * (new Date(a[k]) - new Date(b[k])));
  };
  const project = (row, select) => {
    if (!select) return { ...row };
    const out = {};
    for (const k of Object.keys(select)) {
      if (k === 'employee') { const e = state.employees[row.employeeId]; out.employee = e ? { ...e } : null; } else if (select[k]) out[k] = row[k];
    }
    return out;
  };
  const maybeFail = (op) => {
    state.ops.push(op);
    if (state.failNext && state.failNext.op === op) { const e = state.failNext.error; state.failNext = null; throw e; }
  };
  const forbidden = (name) => () => { throw new Error(`forbidden prisma call: ${name}`); };
  const prisma = {
    errorReport: {
      async findFirst({ where, orderBy, select }) { maybeFail('report.findFirst'); const rows = sortBy(state.reports.filter((r) => matches(r, where)), orderBy); return rows.length ? project(rows[0], select) : null; },
      async create({ data }) { maybeFail('report.create'); const t = now(); const row = { id: `rep-${++state.seq}`, isHandled: false, createdAt: t, updatedAt: t, attachmentUrls: null, ...data }; state.reports.push(row); return { ...row }; },
      async update({ where, data }) { maybeFail('report.update'); const row = state.reports.find((r) => r.id === where.id); if (!row) throw new Error('not found'); Object.assign(row, data); return { ...row }; },
    },
    errorReportReply: {
      async findFirst({ where, orderBy, select }) { maybeFail('reply.findFirst'); const rows = sortBy(state.replies.filter((r) => matches(r, where)), orderBy); return rows.length ? project(rows[0], select) : null; },
      async findMany({ where, orderBy, select }) { maybeFail('reply.findMany'); return sortBy(state.replies.filter((r) => matches(r, where)), orderBy).map((r) => project(r, select)); },
      async count({ where }) { maybeFail('reply.count'); return state.replies.filter((r) => matches(r, where)).length; },
      async create({ data, select }) { maybeFail('reply.create'); const row = { id: `rpl-${++state.seq}`, createdAt: now(), attachmentUrls: null, sketchHtml: null, ...data }; state.replies.push(row); return select ? project(row, select) : { ...row }; },
    },
    employee: {
      async findMany() { return state.owners.map((email) => ({ email })); },
      async findUnique({ where }) { return state.employees[where.id] || null; },
    },
    $transaction: forbidden('$transaction'),
    $queryRawUnsafe: forbidden('$queryRawUnsafe'),
    $executeRawUnsafe: forbidden('$executeRawUnsafe'),
    $queryRaw: forbidden('$queryRaw'),
    $executeRaw: forbidden('$executeRaw'),
    auditLog: new Proxy({}, { get() { throw new Error('manual AuditLog write is forbidden'); } }),
  };
  return { state, prisma };
}

async function storeSmoke() {
  const { state, prisma } = makeFakePrisma();
  const ran = await withTsHooks({ '@/app/lib/prisma': { __esModule: true, default: prisma } }, async (req) => {
    try {
      const store = req(path.join(root, 'lib/policyQuestionnaire/store.js'));
      const respondent = { name: 'דנה לוי', role: 'הנהלה ראשית' };
      const answers = pruneHidden(NEVE, completeAnswers(NEVE));
      const m = firstMulti(NEVE);
      answers[m.id] = mkAnswer(m, { choices: [0, 1], other: true, otherText: 'עוד סיבה' });
      const args = { qn: NEVE, questionnaireKey: QUESTIONNAIRE_KEY, respondent, answers };

      assert.deepEqual(await store.listSubmissions(QUESTIONNAIRE_KEY), { threadId: null, replies: [] }, 'אין שרשור עד השליחה הראשונה');
      assert.equal(await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-1'), null);
      assert.equal(state.reports.length, 0, 'קריאה לא יוצרת שרשור');

      const s1 = await store.submitAnswers({ ...args, employeeId: 'emp-1' });
      assert.equal(state.reports.length, 1);
      assert.equal(state.replies.length, 1);
      const th = state.reports[0];
      assert.equal(th.title, '📋 שאלון מדיניות ביטולים וזיכויים');
      assert.equal(th.queryParams, 'policy-questionnaire:refunds-2026-10b');
      assert.equal(th.url, '/refund-questionnaire');
      assert.equal(th.status, 'OPEN');
      assert.equal(th.employeeId, 'emp-1', 'השרשור על שם מי ששלחה ראשונה');
      assert.equal(th.needsHuman, true, 'בוט התיקונים מדלג');
      assert.equal(th.isReadByProgrammer, false, 'המתכנת רואה "לא נקרא"');
      assert.equal(th.isReadByUser, true);
      assert.ok(th.userText.startsWith(THREAD_TITLE) && th.userText.includes('נווה יעקב'));
      const r1 = state.replies[0];
      assert.equal(r1.errorReportId, th.id);
      assert.equal(r1.employeeId, 'emp-1');
      assert.equal(r1.isProgrammer, false);
      assert.equal(r1.isQuestion, false);
      assert.equal(r1.text, s1.text);
      assert.equal(s1.updated, false);
      assert.ok(!r1.text.split('\n')[1].startsWith('עדכון'));
      assert.deepEqual(parseSubmissionText(NEVE, r1.text).answers, normalizedAll(NEVE, answers), 'כל התשובות (כולל מרובת-בחירה) ברות פענוח מהתגובה');
      for (const q of visibleQuestions(NEVE, answers)) assert.ok(r1.text.includes(`${q.id} ${q.text_he}`) && answerLines(q, answers[q.id]).every((l) => r1.text.includes(l)));

      const before = JSON.stringify(state.replies[0]);
      const s2 = await store.submitAnswers({ ...args, employeeId: 'emp-1', answers: { ...answers, [m.id]: mkAnswer(m, { choices: [1] }) } });
      assert.equal(state.reports.length, 1, 'לא נוצר שרשור שני');
      assert.equal(state.replies.length, 2);
      assert.equal(JSON.stringify(state.replies[0]), before, 'תגובה ישנה לא נערכה');
      assert.equal(s2.threadId, s1.threadId);
      assert.equal(s2.updated, true);
      assert.ok(state.replies[1].text.split('\n')[1].startsWith('עדכון'));
      assert.deepEqual(parseSubmissionText(NEVE, state.replies[1].text).answers[m.id].choices, [1]);

      th.isReadByProgrammer = true; th.needsHuman = false; th.status = 'ARCHIVED'; th.isHandled = true;
      const s3 = await store.submitAnswers({ ...args, employeeId: 'emp-2', respondent: { name: 'רבקה', role: 'הנהלה ראשית' } });
      assert.equal(state.reports.length, 1);
      assert.equal(state.reports[0].employeeId, 'emp-1');
      assert.equal(s3.updated, false);
      assert.equal(state.reports[0].isReadByProgrammer, false, 'שליחה חדשה מסמנת שרשור כלא נקרא');
      assert.equal(state.reports[0].needsHuman, true, 'הדגל נקבע מחדש (מתכנת שענה מאפס אותו)');
      assert.equal(state.reports[0].status, 'OPEN', 'שרשור בארכיון חוזר לפתוח');
      assert.equal(state.reports[0].isHandled, false);

      const last = await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-1');
      assert.equal(last.count, 2);
      assert.equal(last.id, state.replies[1].id);
      assert.equal(await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-nobody'), null);
      state.replies.push({ id: 'free', errorReportId: th.id, employeeId: 'prog', isProgrammer: true, text: 'שאלה חופשית', isQuestion: true, createdAt: new Date(Date.UTC(2026, 9, 6, 9, 0, 0)) });
      const list = await store.listSubmissions(QUESTIONNAIRE_KEY);
      assert.equal(list.threadId, th.id);
      assert.equal(list.replies.length, 3);
      assert.ok(list.replies.every((r) => r.text.startsWith(THREAD_TITLE)));
      assert.deepEqual(list.replies.map((r) => r.employeeId), ['emp-1', 'emp-1', 'emp-2']);
      assert.equal(await store.getLastSubmission('refunds-2099-01', 'emp-1'), null);

      state.reports.push({ ...state.reports[0], id: 'rep-dup', createdAt: new Date(Date.UTC(2026, 9, 7)) });
      assert.equal((await store.listSubmissions(QUESTIONNAIRE_KEY)).threadId, th.id);

      state.ops.length = 0;
      state.failNext = { op: 'report.findFirst', error: Object.assign(new Error("Can't reach database server"), { code: 'P1001' }) };
      const t0 = Date.now();
      assert.ok((await store.listSubmissions(QUESTIONNAIRE_KEY)).threadId);
      assert.ok(Date.now() - t0 >= 1400, 'השהיה לפני הניסיון החוזר');
      assert.equal(state.ops.filter((o) => o === 'report.findFirst').length, 2);
      state.failNext = { op: 'report.findFirst', error: new Error('boom') };
      let err;
      try { await store.listSubmissions(QUESTIONNAIRE_KEY); } catch (e) { err = e; }
      assert.ok(err instanceof store.PolicyQuestionnaireDbError && err.kind === 'other' && err.userMessage.includes('נסו שוב'));
      state.failNext = { op: 'reply.create', error: Object.assign(new Error("Can't reach database server"), { code: 'P1001' }) };
      state.ops.length = 0;
      let werr;
      try { await store.submitAnswers({ ...args, employeeId: 'emp-1' }); } catch (e) { werr = e; }
      assert.ok(werr instanceof store.PolicyQuestionnaireDbError && werr.kind === 'transient');
      assert.equal(state.ops.filter((o) => o === 'reply.create').length, 1, 'כתיבה לא מנוסה שוב אוטומטית');
      assert.equal(state.replies.filter((r) => r.employeeId === 'emp-1').length, 2, 'לא נוספה תגובה');

      const nBefore = state.replies.length;
      state.failNext = { op: 'report.update', error: new Error('flags failed') };
      const s4 = await store.submitAnswers({ ...args, employeeId: 'emp-2', respondent: { name: 'רבקה', role: '' } });
      assert.equal(state.replies.length, nBefore + 1);
      assert.equal(s4.updated, true);
      passed += 1;
      console.log('ok store smoke: find-or-create, אידמפוטנטיות, "עדכון", דגלי השרשור, קריאות, ניסיון חוזר רק בקריאה');
    } catch (e) {
      failed += 1;
      failures.push(`Store smoke\n    ${String(e && e.stack).split('\n').slice(0, 8).join('\n    ')}`);
    }
  });
  return ran;
}
function normalizedAll(qn, answers) { return pruneHidden(qn, sanitizeAnswers(qn, answers)); }

async function routesSmoke() {
  const { state: db, prisma } = makeFakePrisma();
  const sys = { user: null, mails: [], mailBehavior: () => ({ success: true }) };
  db.employees = { 'emp-1': { firstName: 'דנה', lastName: 'לוי', fullName: null }, 'emp-2': { firstName: 'רבקה', lastName: 'כהן', fullName: null } };
  db.owners = ['owner@example.com'];
  const stubs = {
    '@/app/lib/prisma': { __esModule: true, default: prisma },
    '@/lib/auth': {
      HEAD_MANAGEMENT_ROLES: [0, 2],
      checkAuth: async () => !!sys.user && [0, 2].includes(sys.user.roleId),
      getSessionEmployee: async () => (sys.user ? { id: sys.user.id, roleId: sys.user.roleId, isActive: true } : null),
    },
    '@/lib/mailer': { sendSystemEmail: async (o) => { sys.mails.push(o); return sys.mailBehavior(o); } },
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }) } },
  };
  const savedOrg = process.env.GEMACH_ORG;
  process.env.GEMACH_ORG = 'neve-yaakov';
  const ran = await withTsHooks(stubs, async (req) => {
    const call = async (handler, method, body) => {
      const request = new Request('https://gmach-neve-yaakov.vercel.app/api/policy-questionnaire', {
        method, headers: { host: 'gmach-neve-yaakov.vercel.app', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
      });
      const res = await handler(request);
      return { status: res.status, json: await res.json() };
    };
    try {
      const main = req(path.join(root, 'app/api/policy-questionnaire/route.js'));
      const resend = req(path.join(root, 'app/api/policy-questionnaire/resend/route.js'));
      const answersRoute = req(path.join(root, 'app/api/policy-questionnaire/answers/route.js'));
      const full = completeAnswers(NEVE);
      const s = firstSingle(NEVE); const m = firstMulti(NEVE);
      const dep = dependents(NEVE)[0];
      const link = 'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers';
      assert.equal(main.PUT, undefined, 'אין שמירה אוטומטית בשרת');

      sys.user = null;
      assert.equal((await call(main.GET, 'GET')).status, 401);
      assert.equal((await call(main.POST, 'POST', { answers: full, name: 'x' })).status, 401);
      sys.user = { id: 'emp-branch', roleId: 1 };
      for (const [h, mt, b] of [[main.GET, 'GET'], [main.POST, 'POST', { answers: full, name: 'x' }], [resend.POST, 'POST'], [answersRoute.GET, 'GET']]) assert.equal((await call(h, mt, b)).status, 403);
      assert.equal(db.reports.length + db.replies.length, 0, 'שום דבר לא נכתב');
      assert.equal(sys.mails.length, 0);

      sys.user = { id: 'emp-1', roleId: 0 };
      const g = await call(main.GET, 'GET');
      assert.equal(g.status, 200);
      assert.equal(g.json.questionnaire.gmachName, 'נווה יעקב');
      assert.equal(flattenQuestions(g.json.questionnaire).length, flattenQuestions(NEVE).length);
      assert.ok(flattenQuestions(g.json.questionnaire).some((q) => q.kind === 'multi'));
      assert.ok(!JSON.stringify(g.json).includes('"source"'));
      assert.equal(g.json.respondent.name, 'דנה לוי');
      assert.equal(g.json.respondent.role, 'הנהלה ראשית');
      assert.deepEqual(g.json.answers, {});
      assert.equal(g.json.submission, null);
      assert.equal(g.json.questionnaireKey, 'refunds-2026-10b');
      assert.equal(db.reports.length, 0, 'GET לא יוצר שרשור');

      const bad = await call(main.POST, 'POST', { answers: { [s.id]: { choice: 0 } }, name: 'דנה' });
      assert.equal(bad.status, 400);
      assert.ok(bad.json.errors.length >= visibleQuestions(NEVE, {}).length - 1);
      assert.equal((await call(main.POST, 'POST', { name: 'דנה' })).status, 400, 'בלי answers');
      assert.equal((await call(main.POST, 'POST', { answers: { ...full, [s.id]: { choice: OTHER, otherText: '  ' } }, name: 'דנה' })).status, 400);
      assert.equal((await call(main.POST, 'POST', { answers: { ...full, [m.id]: { choices: [], other: false, undecided: false } }, name: 'דנה' })).status, 400, 'מרובת-בחירה בלי סימון');
      assert.equal((await call(main.POST, 'POST', { answers: { ...full, [m.id]: { choices: [0], other: true, otherText: ' ' } }, name: 'דנה' })).status, 400, 'אחר בלי טקסט');
      assert.equal(db.reports.length + db.replies.length, 0);
      assert.equal(sys.mails.length, 0);
      const rawBad = await main.POST(new Request('https://x.vercel.app/api/policy-questionnaire', { method: 'POST', body: '{not json' }));
      assert.equal(rawBad.status, 400);

      db.owners = ['owner@example.com', 'OWNER@example.com', 'second@example.com'];
      const sent = {
        ...full,
        [s.id]: { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה' },
        [m.id]: { choices: [1, 0, 0, 77], other: true, otherText: 'סיבה נוספת' },
        [dep.id]: { choice: 0 }, bogus: { choice: 0 },
        [dep.showIf.questionId]: hidingAnswer(NEVE, dep),
      };
      if (dep.showIf.questionId === m.id) sent[m.id] = { choices: [], undecided: true };
      const ok1 = await call(main.POST, 'POST', { answers: sent, name: 'דנה לוי', role: 'הנהלה ראשית', employeeId: 'emp-ATTACKER' });
      assert.equal(ok1.status, 200);
      assert.equal(ok1.json.success, true);
      assert.equal(ok1.json.emailSent, true);
      assert.equal(db.reports.length, 1);
      assert.equal(db.replies.length, 1);
      assert.equal(db.replies[0].employeeId, 'emp-1', 'הזהות מהעוגייה, לא מהגוף');
      assert.equal(db.reports[0].employeeId, 'emp-1');
      assert.deepEqual(sys.mails.map((x) => x.to), ['owner@example.com', 'second@example.com'], 'מייל אחד לכל נמען, בלי כפילויות');
      assert.equal(sys.mails[0].subject, 'שאלון מדיניות ביטולים וזיכויים - נווה יעקב - דנה לוי');
      assert.ok(sys.mails[0].body.includes(link) && sys.mails[0].html.includes(link));
      assert.ok(sys.mails[0].body.includes('אחר: שבעה ימים'));
      assert.ok(sys.mails[0].body.startsWith(db.replies[0].text.split('\n')[0]), 'גוף המייל הוא אותו טקסט של התגובה');
      assert.ok(db.replies[0].text.includes('תשובה: אחר: שבעה ימים') && db.replies[0].text.includes('הערה: הערה'));
      assert.ok(!db.replies[0].text.includes(`${dep.id} ${dep.text_he}`), 'מותנית מוסתרת נגזמה');
      assert.ok(!db.replies[0].text.includes('bogus'));
      assert.ok(!sys.mails[0].body.includes('עדכון - זו גרסה'));
      assert.equal(ok1.json.updated, false);

      const g2 = await call(main.GET, 'GET');
      assert.equal(g2.json.answers[s.id].choice, OTHER);
      assert.equal(g2.json.answers[s.id].otherText, 'שבעה ימים');
      assert.equal(g2.json.answers[s.id].comment, 'הערה');
      if (dep.showIf.questionId !== m.id) {
        assert.deepEqual(g2.json.answers[m.id].choices, [0, 1], 'שחזור תשובה מרובת-בחירה לעדכון');
        assert.deepEqual([g2.json.answers[m.id].other, g2.json.answers[m.id].otherText], [true, 'סיבה נוספת']);
      }
      assert.equal(g2.json.submission.count, 1);
      assert.equal(g2.json.respondent.name, 'דנה לוי');
      sys.user = { id: 'emp-2', roleId: 0 };
      const g3 = await call(main.GET, 'GET');
      assert.deepEqual(g3.json.answers, {});
      assert.equal(g3.json.submission, null);
      assert.equal(g3.json.respondent.name, 'רבקה כהן');
      sys.user = { id: 'emp-1', roleId: 0 };

      sys.mails.length = 0;
      const ok2 = await call(main.POST, 'POST', { answers: { ...full, [s.id]: { choice: 0 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
      assert.equal(ok2.json.updated, true);
      assert.equal(db.reports.length, 1, 'שרשור אחד לגמ"ח');
      assert.equal(db.replies.length, 2);
      assert.ok(db.replies[1].text.split('\n')[1].startsWith('עדכון'));
      assert.equal(sys.mails.length, 2);
      assert.ok(sys.mails[0].subject.endsWith(' (עודכן)'));
      assert.equal((await call(main.GET, 'GET')).json.submission.count, 2);

      sys.mails.length = 0;
      sys.mailBehavior = () => ({ success: false, message: 'Apps Script down' });
      const fail = await call(main.POST, 'POST', { answers: { ...full, [s.id]: { choice: 1 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
      assert.equal(fail.status, 200);
      assert.equal(fail.json.success, true);
      assert.equal(fail.json.emailSent, false);
      assert.ok(fail.json.emailError.includes('Apps Script down'));
      assert.equal(db.replies.length, 3, 'התשובות לא אבדו');
      sys.mailBehavior = () => ({ success: true });
      sys.mails.length = 0;
      const repliesBefore = db.replies.length;
      const retry = await call(resend.POST, 'POST');
      assert.equal(retry.json.emailSent, true);
      assert.equal(sys.mails.length, 2);
      assert.ok(sys.mails[0].subject.endsWith(' (עודכן)'));
      assert.ok(sys.mails[0].body.includes(s.options_he[1]), 'השליחה האחרונה');
      assert.equal(db.replies.length, repliesBefore, 'ניסיון חוזר לא כותב בשרשור');
      db.owners = [];
      const noOwner = await call(resend.POST, 'POST');
      assert.equal(noOwner.json.emailSent, false);
      assert.ok(noOwner.json.emailError.includes('כתובת מייל'));
      db.owners = ['owner@example.com'];
      sys.mailBehavior = () => { throw new Error('boom'); };
      const thrown = await call(resend.POST, 'POST');
      assert.equal(thrown.status, 200);
      assert.equal(thrown.json.emailSent, false);
      sys.mailBehavior = () => ({ success: true });
      sys.user = { id: 'emp-2', roleId: 2 };
      assert.equal((await call(resend.POST, 'POST')).status, 400);

      db.replies.push({ id: 'free', errorReportId: db.reports[0].id, employeeId: 'prog', isProgrammer: true, text: 'שאלה חופשית', isQuestion: true, createdAt: new Date(Date.UTC(2026, 9, 6, 12, 0, 0)) });
      await call(main.POST, 'POST', { answers: full, name: 'רבקה כהן', role: 'הנהלה' });
      sys.user = { id: 'emp-1', roleId: 0 };
      const r0 = await call(answersRoute.GET, 'GET');
      assert.equal(r0.status, 200);
      assert.equal(r0.json.threadFound, true);
      assert.deepEqual(r0.json.respondents.map((r) => r.name).sort(), ['דנה לוי', 'רבקה כהן']);
      const dana = r0.json.respondents.find((r) => r.name === 'דנה לוי');
      assert.equal(dana.count, 3);
      assert.equal(dana.earlier.length, 2);
      assert.ok(dana.latest.text.startsWith(THREAD_TITLE) && dana.latest.answers[s.id].choice === 1);
      assert.ok(dana.earlier.every((e) => e.text && !('answers' in e)));
      assert.ok(!JSON.stringify(r0.json).includes('"source"'));
      assert.ok(!JSON.stringify(r0.json).includes('שאלה חופשית'), 'תגובה חופשית בשרשור לא נכנסת לתוצאות');
      sys.user = { id: 'emp-2', roleId: 2 };
      const r2 = await call(answersRoute.GET, 'GET');
      assert.ok(!JSON.stringify(r2.json.questionnaire).includes('"source"'), 'גם הבעלים לא מקבל שדות מקור');

      // הגמ"ח הראשי: אותן שאלות, כותרת אחרת, שרשור משלו (DB נפרד)
      process.env.GEMACH_ORG = 'main';
      const mainDb = makeFakePrisma();
      Object.assign(db, { reports: mainDb.state.reports, replies: mainDb.state.replies });
      sys.user = { id: 'emp-1', roleId: 0 };
      const gm = await call(main.GET, 'GET');
      assert.equal(gm.json.questionnaire.gmachName, 'מכובד');
      assert.deepEqual(flattenQuestions(gm.json.questionnaire).map((q) => q.id), flattenQuestions(NEVE).map((q) => q.id), 'אותם מזהים בשני הגמחים');
      const okm = await call(main.POST, 'POST', { answers: completeAnswers(MAIN), name: 'דנה', role: '' });
      assert.equal(okm.status, 200);
      assert.ok(db.replies[0].text.includes('מכובד') && db.replies[0].text.includes(`${flattenQuestions(MAIN)[0].id} `));
      assert.ok(sys.mails.at(-1).subject.includes('מכובד'));
      process.env.GEMACH_ORG = 'neve-yaakov';

      db.failNext = { op: 'report.findFirst', error: new Error('boom') };
      const dbErr = await call(main.GET, 'GET');
      assert.equal(dbErr.status, 503);
      assert.ok(dbErr.json.error.includes('נסו שוב'));
      passed += 1;
      console.log('ok routes smoke: הרשאות, שרשור אחד, ולידציה (כולל מרובת-בחירה), "עדכון" ושחזור, מייל אחד, כשל מייל וניסיון חוזר, תוצאות לפי משיבה, שני גמחים');
    } catch (e) {
      failed += 1;
      failures.push(`Routes smoke\n    ${String(e && e.stack).split('\n').slice(0, 8).join('\n    ')}`);
    }
  });
  if (savedOrg === undefined) delete process.env.GEMACH_ORG; else process.env.GEMACH_ORG = savedOrg;
  return ran;
}

// ---------------------------------------------------------------------------
// רינדור בצד שרת (SSR) של הרכיבים והדפים - מדולג אם אין react-dom / typescript
// ---------------------------------------------------------------------------
async function ssrSmoke() {
  const noop = () => {};
  const stubs = {
    'next/link': { __esModule: true, default: ({ href, children }) => createRequire(path.join(root, 'package.json'))('react').createElement('a', { href }, children) },
    '@/lib/policyQuestionnaire/access': {
      requireHeadManagement: async () => ({ ok: true, employee: { id: 'emp-1', roleId: 2, name: 'דנה', roleLabel: '' } }),
      loadResultsPayload: async () => ssrState.payload(),
    },
    '@/lib/policyQuestionnaire/store': { PolicyQuestionnaireDbError: class extends Error { constructor(k) { super(k); this.kind = k; this.userMessage = 'שגיאת מסד'; } } },
  };
  const ssrState = { payload: () => null };
  const ran = await withTsHooks(stubs, async (req) => {
    try {
      const ReactDOMServer = req('react-dom/server');
      const React = req('react');
      const h = React.createElement;
      const render = (el) => ReactDOMServer.renderToStaticMarkup(el);
      const { FormView, DoneView } = req(path.join(root, 'app/refund-questionnaire/RefundQuestionnaireClient.js'));
      const AnswersClient = req(path.join(root, 'app/refund-questionnaire/answers/AnswersClient.js')).default;
      const baseProps = (qn, answers, over = {}) => ({
        qn, answers, name: 'דנה לוי', role: 'הנהלה', saveState: 'saved', showErrors: false, editingSent: false, submission: null, draftInfo: null, discardDraft: noop,
        submitError: '', submitting: false, confirmOpen: false, openComments: {}, setOpenComments: noop, changeName: noop, changeRole: noop,
        setAnswer: noop, toggleAnswer: noop, requestSubmit: noop, doSubmit: noop, setConfirmOpen: noop, ...over,
      });

      for (const [label, qn0] of [['org1', MAIN], ['org2', NEVE]]) {
        const qn = publicQuestionnaire(qn0);
        const answers = mailAnswers(qn0);
        const vis = visibleQuestions(qn0, answers);
        const html = render(h(FormView, baseProps(qn, answers)));
        assert.ok(html.includes('dir="rtl"'), `${label} rtl`);
        assert.ok(html.includes(qn.gmachName));
        assert.equal((html.match(/id="rq-q-[^"]*" class="rq-card/g) || []).length, vis.length, `${label}: כרטיס לכל שאלה גלויה`);
        const nRadio = vis.filter((q) => !isMulti(q)).reduce((n, q) => n + optionsForQuestion(q).length, 0);
        const nCheck = vis.filter((q) => isMulti(q)).reduce((n, q) => n + optionsForQuestion(q).length, 0);
        assert.equal((html.match(/type="radio"/g) || []).length, nRadio, `${label}: כפתורי רדיו לבחירה-אחת`);
        assert.equal((html.match(/type="checkbox"/g) || []).length, nCheck, `${label}: תיבות סימון למרובת-בחירה`);
        assert.equal((html.match(/>אפשר לסמן כמה</g) || []).length, vis.filter((q) => isMulti(q)).length);
        assert.equal((html.match(/>לסמן אחת</g) || []).length, vis.filter((q) => !isMulti(q)).length);
        assert.ok(html.includes('role="group"') && html.includes('role="radiogroup"'));
        assert.ok(html.includes('ענית על') && html.includes('נשמר בדפדפן') && html.includes('הטיוטה נשמרת רק בדפדפן הזה עד השליחה'));
        assert.ok(html.includes(UNDECIDED_LABEL) && html.includes('דוגמה:') && html.includes(OTHER_LABEL));
        const withToday = vis.find((q) => q.today_he);
        assert.ok(withToday && html.includes(`כך זה עובד היום ב${qn.gmachName} (לידיעה בלבד):`) && html.includes(withToday.today_he), 'שורת "היום" מוצגת כמידע');
        assert.ok(html.includes('שלושה ימים &lt;b&gt;מהאירוע&lt;/b&gt;') || html.includes('value="שלושה ימים'), 'טקסט "אחר" בתיבה');
        assert.ok(html.includes('rq-other'), 'תיבת טקסט ל"אחר"');
        assert.ok(!html.includes('למה שואלים') && !html.includes('"source"'));
        const textOnly = html.replace(/<[^>]*>/g, ' ');
        assert.ok(!FORBIDDEN.some(([, re]) => re.test(textOnly)), 'אין מילים אסורות בטקסט המרונדר');
        assert.ok(html.includes('>שליחה<'));
        const mQ = vis.find((q) => isMulti(q));
        const mOn = (html.match(new RegExp(`id="rq-q-${mQ.id.replace('.', '\\.')}"[\\s\\S]*?(?=id="rq-q-|$)`)) || [''])[0];
        assert.equal((mOn.match(/type="checkbox"[^>]*checked/g) || []).length, 3, 'שתי אפשרויות + "אחר" מסומנות באותה שאלה');
        const withErr = render(h(FormView, baseProps(qn, {}, { showErrors: true, confirmOpen: true, name: '' })));
        assert.ok(withErr.includes('rq-missing') && withErr.includes('נא לבחור תשובה') && withErr.includes('נא לסמן לפחות תשובה אחת') && withErr.includes('נא למלא שם') && withErr.includes('לשלוח את התשובות?'));
        const restored = render(h(FormView, baseProps(qn, answers, { draftInfo: { savedAt: Date.UTC(2026, 9, 6, 8, 0) }, editingSent: true, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 1 } })));
        assert.ok(restored.includes('שוחזרה טיוטה שנשמרה בדפדפן הזה') && restored.includes('מחיקת הטיוטה והתחלה מחדש') && restored.includes('06.10.2026 00:30') && restored.includes('התשובות כבר נשלחו פעם אחת'));
        assert.ok(render(h(FormView, baseProps(qn, answers, { saveState: 'nostore' }))).includes('הדפדפן לא מאפשר לשמור טיוטה'));
      }
      const neveQ = publicQuestionnaire(NEVE);
      const dep = dependents(NEVE)[0];
      const formWith = (ans) => render(h(FormView, baseProps(neveQ, ans)));
      assert.ok(!formWith({}).includes(dep.text_he));
      assert.ok(formWith({ [dep.showIf.questionId]: showingAnswer(NEVE, dep) }).includes(dep.text_he));

      const doneAnswers = mailAnswers(NEVE);
      const done = render(h(DoneView, { qn: neveQ, answers: doneAnswers, name: 'דנה', mail: { emailSent: false, emailError: 'x' }, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 1 }, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב') && done.includes('ניסיון חוזר') && done.includes('עדכון התשובות') && done.includes('dir="rtl"') && done.includes('נשלח ב-06.10.2026 00:30'));
      const mq = visibleQuestions(NEVE, doneAnswers).find((q) => isMulti(q));
      assert.ok(done.includes(`• ${mq.options_he[0]}`) && done.includes(`• ${mq.options_he[1]}`) && done.includes('• אחר: סיבה'), 'סיכום התודה: שורה לכל אפשרות');
      const done2 = render(h(DoneView, { qn: neveQ, answers: doneAnswers, name: 'דנה', mail: { emailSent: true }, submission: null, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done2.includes('נשלחו במייל לבעלים') && !done2.includes('המייל לא נשלח'));
      const done3 = render(h(DoneView, { qn: neveQ, answers: doneAnswers, name: 'דנה', mail: null, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 2, partial: true }, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done3.includes('אלה התשובות האחרונות ששלחת') && done3.includes('לא נטענו מחדש') && !done3.includes('המייל לא נשלח'));

      // דף התוצאות (רכיב + דף שרת)
      const s = firstSingle(NEVE); const m = firstMulti(NEVE);
      const mk = (id, employeeId, createdAt, o = {}) => ({ id, employeeId, employeeName: '', createdAt, text: renderSubmissionText(NEVE, o.answers || completeAnswers(NEVE), { respondentName: o.name || 'דנה', respondentRole: 'הנהלה', submittedAt: createdAt, updated: !!o.updated }) });
      const groups = groupSubmissions(NEVE, [
        mk('a1', 'e1', '2026-10-06T08:00:00Z'),
        mk('a2', 'e1', '2026-10-06T10:00:00Z', { updated: true, answers: { ...completeAnswers(NEVE), [s.id]: mkAnswer(s, { choice: OTHER, otherText: 'אחר מיוחד' }), [m.id]: mkAnswer(m, { choices: [0, 1] }) } }),
        mk('b1', 'e2', '2026-10-06T09:00:00Z', { name: 'רבקה' }),
      ]);
      const respondents = groups.map((g) => ({ key: g.key, name: g.name, role: g.role, count: g.count, latest: g.latest, earlier: g.earlier.map((e) => ({ id: e.id, createdAt: e.createdAt, text: e.text, updated: e.updated })) }));
      const ans = render(h(AnswersClient, { questionnaire: neveQ, respondents, threadFound: true }));
      assert.ok(ans.includes('dir="rtl"') && ans.includes('העתק הכל') && ans.includes('הדפסה') && ans.includes('דנה') && ans.includes('רבקה') && ans.includes('אחר: אחר מיוחד'));
      assert.ok(ans.includes(`• ${m.options_he[0]}`) && ans.includes(`• ${m.options_he[1]}`), 'תשובות מרובות-בחירה בשורות');
      assert.ok(ans.includes('(אפשר היה לסמן כמה)'), 'ספירה מסומנת כמרובת-בחירה');
      assert.ok(ans.includes('גרסאות קודמות (1)') && ans.includes('<details') && ans.includes('2 שליחות'), 'האחרונה במלואה + גרסאות קודמות מקופלות');
      assert.ok(ans.includes('עדכון') && ans.includes(THREAD_TITLE) && ans.includes('דיווח על שגיאות'));
      assert.ok(!ans.includes('מקור:'));
      const empty = render(h(AnswersClient, { questionnaire: neveQ, respondents: [], threadFound: false }));
      assert.ok(empty.includes('עדיין אף אחת לא שלחה תשובות') && empty.includes('השרשור ייווצר בשליחה הראשונה'));
      const partialText = renderSubmissionText(NEVE, completeAnswers(NEVE), { respondentName: 'שרה' }).replace(`• ${m.options_he[0]}`, '• נוסח ישן').replace(`תשובה: ${s.options_he[0]}`, 'תשובה: נוסח ישן');
      const partialGroups = groupSubmissions(NEVE, [{ id: 'p1', employeeId: 'e3', employeeName: '', createdAt: '2026-10-06T08:00:00Z', text: partialText }]);
      const partialHtml = render(h(AnswersClient, { questionnaire: neveQ, threadFound: true, respondents: partialGroups.map((g) => ({ key: g.key, name: g.name, role: g.role, count: g.count, latest: g.latest, earlier: [] })) }));
      assert.ok(partialHtml.includes('לא כל התשובות זוהו') && partialHtml.includes('נוסח ישן') && partialHtml.includes('rq-raw'));

      const page = req(path.join(root, 'app/refund-questionnaire/answers/page.js')).default;
      ssrState.payload = () => ({ questionnaire: neveQ, threadFound: true, respondents });
      const pageHtml = render(await page());
      assert.ok(pageHtml.includes('דנה') && pageHtml.includes('העתק הכל'));
      ssrState.payload = () => { throw new (stubs['@/lib/policyQuestionnaire/store'].PolicyQuestionnaireDbError)('transient'); };
      const errHtml = render(await page());
      assert.ok(errHtml.includes('callout-danger') && errHtml.includes('שגיאת מסד'));
      passed += 1;
      console.log('ok ssr smoke: FormView (רדיו + תיבות סימון + רמזים) / DoneView / AnswersClient / דף התוצאות מרונדרים לשני הגמחים');
    } catch (e) {
      failed += 1;
      failures.push(`SSR smoke\n    ${String(e && e.stack).split('\n').slice(0, 8).join('\n    ')}`);
    }
  });
  return ran;
}

await storeSmoke();
await routesSmoke();
await ssrSmoke();

console.log(`\n${passed} passed, ${failed} failed; forbidden-word hits: ${forbiddenHits.length}`);
if (failed) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
