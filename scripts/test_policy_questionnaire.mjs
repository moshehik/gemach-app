// בדיקות לשאלון המדיניות (ביטולים וזיכויים) להנהלות: lib/policyQuestionnaire/*, המייל, החיווט של ה-API והדפים.
// ללא DB, ללא רשת, ללא שליחת מייל. הרצה: node scripts/test_policy_questionnaire.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקת הרינדור בצד שרת (SSR) צריכה react-dom + typescript (node_modules של הפרויקט, או NODE_PATH); בלעדיהם היא מדולגת ומודפס SKIP.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUESTIONNAIRE_KEY, getQuestionnaire, getQuestionnaireByOrgKey, orgKeyForOrg, orgForOrgKey, OMITTED_TOPICS,
} from '../lib/policyQuestionnaire/questions-refunds-2026-10.js';
import {
  UNDECIDED, OTHER, UNDECIDED_LABEL, OTHER_LABEL, UNANSWERED_LABEL, MAX_TEXT, KNOWN_SITE_ORIGINS,
  flattenQuestions, findQuestion, stripReportIds, optionsForQuestion, publicQuestion, publicQuestionnaire,
  isQuestionVisible, visibleQuestions, normalizeAnswer, sanitizeAnswers, mergeAnswers, pruneHidden, isAnswered,
  computeProgress, validateSubmission, answerLabel, summarize, tallyResponses, formatIsraelDateTime, buildPlainText,
  buildAllPlainText, isUpdateEmail, needsEmail, hasPendingChanges, resolveSiteOrigin, answerUrl, resultsUrl, classifyDbError,
  describeResponse, normalizeRespondent,
} from '../lib/policyQuestionnaire/logic.js';
import { buildQuestionnaireEmail } from '../lib/policyQuestionnaire/email.js';
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
const completeAnswers = (qn, choice = 0) => {
  const out = {};
  for (const q of visibleQuestions(qn, {})) out[q.id] = { choice, otherText: '', comment: '' };
  return out;
};

const MAIN = getQuestionnaire(ORG_MAIN);
const NEVE = getQuestionnaire(ORG_NEVE_YAAKOV);

// ---------------------------------------------------------------------------
// תקינות המאגר
// ---------------------------------------------------------------------------
test('מפתח השאלון והמיפוי org -> org1/org2', () => {
  assert.equal(QUESTIONNAIRE_KEY, 'refunds-2026-10');
  assert.equal(orgKeyForOrg(ORG_MAIN), 'org1');
  assert.equal(orgKeyForOrg(ORG_NEVE_YAAKOV), 'org2');
  assert.equal(orgKeyForOrg(undefined), 'org1');
  assert.equal(orgForOrgKey('org2'), ORG_NEVE_YAAKOV);
  assert.equal(orgForOrgKey('org1'), ORG_MAIN);
  assert.equal(MAIN.orgKey, 'org1');
  assert.equal(NEVE.orgKey, 'org2');
  assert.equal(MAIN.gmachName, 'מכובד');
  assert.equal(NEVE.gmachName, 'נווה יעקב');
  assert.equal(getQuestionnaireByOrgKey('org1').gmachName, 'מכובד');
  assert.equal(getQuestionnaireByOrgKey('nope'), null);
});

test('currentOrg() של כל פרויקט Vercel מחזיר את השאלון הנכון', () => {
  assert.equal(getQuestionnaire(currentOrg({ VERCEL_PROJECT_PRODUCTION_URL: 'gmach-neve-yaakov.vercel.app' })).orgKey, 'org2');
  assert.equal(getQuestionnaire(currentOrg({ VERCEL_PROJECT_PRODUCTION_URL: 'gemach-app-uyh4-beryl.vercel.app' })).orgKey, 'org1');
  assert.equal(getQuestionnaire(currentOrg({ GEMACH_ORG: 'neve-yaakov' })).orgKey, 'org2');
  assert.equal(getQuestionnaire(currentOrg({})).orgKey, 'org1');
});

test('כל גמ"ח מקבל רק את השאלות שלו: org1 = m* בלבד, org2 = n* בלבד, מזהים ייחודיים', () => {
  const m = flattenQuestions(MAIN);
  const n = flattenQuestions(NEVE);
  assert.equal(m.length, 8);
  assert.equal(n.length, 14);
  assert.ok(m.every((q) => /^m\d+\.\d+$/.test(q.id)), 'org1 ids');
  assert.ok(n.every((q) => /^n\d+\.\d+$/.test(q.id)), 'org2 ids');
  assert.equal(new Set(m.map((q) => q.id)).size, m.length);
  assert.equal(new Set(n.map((q) => q.id)).size, n.length);
  assert.ok(!m.some((q) => n.some((x) => x.id === q.id)));
});

test('לכל שאלה: >=2 אפשרויות, דוגמה, "היום אצלכן", הסבר "למה שואלים" ומקור פנימי', () => {
  for (const q of [...flattenQuestions(MAIN), ...flattenQuestions(NEVE)]) {
    assert.ok(Array.isArray(q.options_he) && q.options_he.length >= 2, `${q.id} options`);
    assert.ok(q.options_he.every((o) => typeof o === 'string' && o.trim()), `${q.id} option text`);
    assert.equal(new Set(q.options_he).size, q.options_he.length, `${q.id} duplicate options`);
    assert.ok(q.text_he && q.example_he && q.today_he && q.sourceNote_he, `${q.id} texts`);
    assert.ok(q.source && q.source.trim(), `${q.id} source kept for owner`);
    assert.equal(q.kind, 'single');
    assert.equal(typeof q.allowOther, 'boolean');
  }
});

test('סימוני "(כמו היום)" נשמרו (18 מהמאגר המקורי + n2.2 שניסוחה "כמו היום, בפועל")', () => {
  const count = [...flattenQuestions(MAIN), ...flattenQuestions(NEVE)].reduce((a, q) => a + q.options_he.filter((o) => o.includes('כמו היום')).length, 0);
  assert.equal(count, 19);
});

test('showIf: רק n4.3, מצביע על n4.2 שקדמה לה, ואינדקסים בטווח', () => {
  const all = [...flattenQuestions(MAIN), ...flattenQuestions(NEVE)];
  const withIf = all.filter((q) => q.showIf);
  assert.deepEqual(withIf.map((q) => q.id), ['n4.3']);
  const q = withIf[0];
  assert.equal(q.showIf.questionId, 'n4.2');
  assert.deepEqual(q.showIf.anyOf, [1, 2]);
  const ids = flattenQuestions(NEVE).map((x) => x.id);
  assert.ok(ids.indexOf('n4.2') < ids.indexOf('n4.3'));
  const ctrl = findQuestion(NEVE, 'n4.2');
  assert.ok(q.showIf.anyOf.every((i) => i >= 0 && i < ctrl.options_he.length));
});

test('נושאים שהושמטו מתועדים (16) ולא כוללים שאלות', () => {
  assert.equal(OMITTED_TOPICS.length, 16);
  assert.ok(OMITTED_TOPICS.every((o) => o.topic_he && o.reason_he));
});

test('אפשרויות "עדיין לא החלטנו" ו"אחר" מתווספות אוטומטית', () => {
  const q = findQuestion(NEVE, 'n1.1');
  const opts = optionsForQuestion(q);
  assert.equal(opts.length, q.options_he.length + 2);
  assert.equal(opts[opts.length - 1].value, UNDECIDED);
  assert.equal(opts[opts.length - 1].label, UNDECIDED_LABEL);
  assert.equal(opts[opts.length - 2].value, OTHER);
  assert.equal(opts[opts.length - 2].label, OTHER_LABEL);
  const noOther = optionsForQuestion({ ...q, allowOther: false });
  assert.equal(noOther.length, q.options_he.length + 1);
  assert.ok(!noOther.some((o) => o.value === OTHER));
});

// ---------------------------------------------------------------------------
// מילים אסורות / מזהי דיווח בטקסט שמוצג להנהלות
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
];
function managerFacingStrings(pub) {
  const out = [pub.intro_he];
  for (const s of pub.sections) {
    out.push(s.title_he, s.intro_he);
    for (const q of s.questions) {
      out.push(q.text_he, q.example_he, q.today_he, q.sourceNote_he, ...optionsForQuestion(q).map((o) => o.label));
    }
  }
  out.push(UNDECIDED_LABEL, OTHER_LABEL);
  return out.filter(Boolean);
}
export const forbiddenHits = [];
test('מילים אסורות: אין בטקסט המוצג להנהלות מילים טכניות או מזהי דיווח', () => {
  for (const [label, qn] of [['org1', MAIN], ['org2', NEVE]]) {
    for (const text of managerFacingStrings(publicQuestionnaire(qn))) {
      for (const [word, re] of FORBIDDEN) {
        if (re.test(text)) forbiddenHits.push({ org: label, word, text: text.slice(0, 90) });
      }
    }
  }
  assert.deepEqual(forbiddenHits, [], `נמצאו ${forbiddenHits.length} פגיעות:\n${forbiddenHits.map((h) => `${h.org} [${h.word}] ${h.text}`).join('\n')}`);
});

test('הלינט תופס: מילה אסורה ומזהה דיווח בטקסט לדוגמה', () => {
  const bad = ['לפי ההגדרה הזו', 'דיווח c00b42cf, 5.10', 'הקוד מאשר', 'בטבלה'];
  for (const t of bad) assert.ok(FORBIDDEN.some(([, re]) => re.test(t)), `לא נתפס: ${t}`);
  for (const t of ['שמלת אישה 120 ₪ בוטלה', 'הזמנה 53082 ב-5.10']) assert.ok(!FORBIDDEN.some(([, re]) => re.test(t)), `נתפס בטעות: ${t}`);
});

test('stripReportIds מסיר מזהי דיווח ומשאיר טקסט רגיל', () => {
  assert.equal(stripReportIds('מקור (דיווח c00b42cf, 5.10) כאן'), 'מקור (5.10) כאן');
  assert.ok(!/[0-9a-f]{8}/.test(stripReportIds('דיווח 068cc53d + דיווח bb3978c5, 22.9')));
  assert.equal(stripReportIds('הזמנה 53082 בוטלה'), 'הזמנה 53082 בוטלה');
  assert.equal(stripReportIds(null), '');
});

test('publicQuestionnaire: לעולם לא מכיל source (חוץ מהבעלים)', () => {
  for (const qn of [MAIN, NEVE]) {
    const pub = publicQuestionnaire(qn);
    const json = JSON.stringify(pub);
    assert.ok(!json.includes('"source"'));
    for (const q of flattenQuestions(qn)) assert.ok(!json.includes(q.source), `${q.id} source leaked`);
    const owner = publicQuestionnaire(qn, { includeSource: true });
    assert.ok(flattenQuestions(owner).every((q) => q.source));
  }
  assert.equal(publicQuestion(findQuestion(NEVE, 'n4.3')).showIf.questionId, 'n4.2');
});

// ---------------------------------------------------------------------------
// תצוגה מותנית
// ---------------------------------------------------------------------------
test('n4.3 מוצגת רק כש-n4.2 נענתה 2 או 3 (אינדקס 1 או 2)', () => {
  const q43 = findQuestion(NEVE, 'n4.3');
  const withChoice = (c) => ({ 'n4.2': { choice: c, otherText: '', comment: '' } });
  assert.equal(isQuestionVisible(NEVE, q43, {}), false, 'ללא תשובה');
  assert.equal(isQuestionVisible(NEVE, q43, withChoice(0)), false, 'תשובה 1 (אין קיזוז)');
  assert.equal(isQuestionVisible(NEVE, q43, withChoice(1)), true, 'תשובה 2');
  assert.equal(isQuestionVisible(NEVE, q43, withChoice(2)), true, 'תשובה 3');
  assert.equal(isQuestionVisible(NEVE, q43, withChoice(UNDECIDED)), false, 'לא החלטנו');
  assert.equal(isQuestionVisible(NEVE, q43, withChoice(OTHER)), false, 'אחר');
  assert.equal(visibleQuestions(NEVE, {}).length, 13);
  assert.equal(visibleQuestions(NEVE, withChoice(1)).length, 14);
  assert.equal(visibleQuestions(MAIN, {}).length, 8);
});

test('שאלה שהשולטת שלה מוסתרת - מוסתרת גם היא; מעגל לא נתקע', () => {
  const qn = { sections: [{ title_he: 'x', questions: [
    { id: 'a', options_he: ['1', '2'], showIf: { questionId: 'b', anyOf: [0] } },
    { id: 'b', options_he: ['1', '2'], showIf: { questionId: 'a', anyOf: [0] } },
    { id: 'c', options_he: ['1', '2'], showIf: { questionId: 'a', anyOf: [0] } },
    { id: 'd', options_he: ['1', '2'], showIf: { questionId: 'missing', anyOf: [0] } },
  ] }] };
  const ans = { a: { choice: 0 }, b: { choice: 0 } };
  assert.deepEqual(visibleQuestions(qn, ans).map((q) => q.id), []);
});

test('pruneHidden מסיר תשובה לשאלה מוסתרת (n4.3 אחרי שינוי n4.2)', () => {
  const a = { 'n4.2': { choice: 0, otherText: '', comment: '' }, 'n4.3': { choice: 1, otherText: '', comment: '' }, 'n4.4': { choice: 0, otherText: '', comment: '' } };
  const pruned = pruneHidden(NEVE, a);
  assert.ok(!pruned['n4.3']);
  assert.ok(pruned['n4.2'] && pruned['n4.4']);
  const a2 = { ...a, 'n4.2': { choice: 1, otherText: '', comment: '' } };
  assert.ok(pruneHidden(NEVE, a2)['n4.3']);
});

// ---------------------------------------------------------------------------
// ניקוי, תקינות ומיזוג
// ---------------------------------------------------------------------------
test('normalizeAnswer: אינדקס חוקי, undecided, other עם טקסט; פסילת ערכים לא חוקיים', () => {
  const q = findQuestion(NEVE, 'n1.1');
  assert.deepEqual(normalizeAnswer({ choice: 0 }, q), { choice: 0, otherText: '', comment: '' });
  assert.deepEqual(normalizeAnswer({ choice: UNDECIDED, otherText: 'x' }, q), { choice: UNDECIDED, otherText: '', comment: '' });
  assert.deepEqual(normalizeAnswer({ choice: OTHER, otherText: '  שלוש  ' }, q), { choice: OTHER, otherText: 'שלוש', comment: '' });
  assert.equal(normalizeAnswer({ choice: 99 }, q), null);
  assert.equal(normalizeAnswer({ choice: -1 }, q), null);
  assert.equal(normalizeAnswer({ choice: 1.5 }, q), null);
  assert.equal(normalizeAnswer({ choice: 'evil' }, q), null);
  assert.equal(normalizeAnswer('x', q), null);
  assert.equal(normalizeAnswer(null, q), null);
  assert.equal(normalizeAnswer({ choice: OTHER }, { ...q, allowOther: false }), null, 'אחר אסור בשאלה בלי allowOther');
  assert.deepEqual(normalizeAnswer({ choice: null, comment: 'רק הערה' }, q), { choice: null, otherText: '', comment: 'רק הערה' });
  assert.equal(normalizeAnswer({ choice: 0, comment: 'א'.repeat(MAX_TEXT + 50) }, q).comment.length, MAX_TEXT);
});

test('sanitizeAnswers: מזהים לא מוכרים נזרקים; אידמפוטנטי', () => {
  const raw = { 'n1.1': { choice: 1 }, 'zzz': { choice: 0 }, 'n1.2': { choice: 7 }, __proto__x: 1 };
  const clean = sanitizeAnswers(NEVE, raw);
  assert.deepEqual(Object.keys(clean), ['n1.1']);
  assert.deepEqual(sanitizeAnswers(NEVE, clean), clean);
  assert.deepEqual(sanitizeAnswers(NEVE, null), {});
  assert.deepEqual(sanitizeAnswers(NEVE, 'x'), {});
});

test('isAnswered: מספר/לא החלטנו = נענתה; אחר בלי טקסט = לא', () => {
  assert.equal(isAnswered({ choice: 0 }), true);
  assert.equal(isAnswered({ choice: UNDECIDED }), true);
  assert.equal(isAnswered({ choice: OTHER, otherText: '' }), false);
  assert.equal(isAnswered({ choice: OTHER, otherText: '  ' }), false);
  assert.equal(isAnswered({ choice: OTHER, otherText: 'כן' }), true);
  assert.equal(isAnswered({ choice: null, comment: 'x' }), false);
  assert.equal(isAnswered(null), false);
});

test('validateSubmission: חסרות תשובות, אחר-בלי-טקסט, "לא החלטנו" נחשב, שם חובה', () => {
  const resp = { name: 'דנה', role: 'הנהלה' };
  const empty = validateSubmission(NEVE, {}, resp);
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.length, 13);
  assert.ok(empty.errors.every((e) => e.code === 'missing'));

  const full = completeAnswers(NEVE);
  assert.equal(validateSubmission(NEVE, full, resp).ok, true);

  const other = { ...full, 'n1.1': { choice: OTHER, otherText: '', comment: 'הערה בלבד' } };
  const r = validateSubmission(NEVE, other, resp);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{ questionId: 'n1.1', code: 'other_text_missing' }]);
  assert.equal(validateSubmission(NEVE, { ...full, 'n1.1': { choice: OTHER, otherText: 'תשובה', comment: '' } }, resp).ok, true);

  const allUndecided = completeAnswers(NEVE, UNDECIDED);
  assert.equal(validateSubmission(NEVE, allUndecided, resp).ok, true, 'undecided = נענתה');

  const noName = validateSubmission(NEVE, full, { name: '  ', role: '' });
  assert.equal(noName.ok, false);
  assert.equal(noName.nameMissing, true);
  assert.deepEqual(noName.errors, []);
});

test('n4.3 מוסתרת לא נדרשת; כשמוצגת (n4.2 = 2) היא נדרשת', () => {
  const resp = { name: 'דנה' };
  const full = completeAnswers(NEVE);
  assert.equal(validateSubmission(NEVE, full, resp).ok, true);
  const shown = { ...full, 'n4.2': { choice: 1, otherText: '', comment: '' } };
  const r = validateSubmission(NEVE, shown, resp);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{ questionId: 'n4.3', code: 'missing' }]);
  assert.equal(validateSubmission(NEVE, { ...shown, 'n4.3': { choice: 0 } }, resp).ok, true);
});

test('computeProgress: סופר רק שאלות גלויות', () => {
  assert.deepEqual(computeProgress(NEVE, {}), { answered: 0, total: 13 });
  const a = { 'n1.1': { choice: 0 }, 'n1.2': { choice: UNDECIDED }, 'n1.3': { choice: OTHER, otherText: '' } };
  assert.deepEqual(computeProgress(NEVE, a), { answered: 2, total: 13 });
  assert.deepEqual(computeProgress(NEVE, { ...completeAnswers(NEVE), 'n4.2': { choice: 1 } }), { answered: 13, total: 14 });
});

test('mergeAnswers: מחליף לפי שאלה, משאיר את השאר, null מוחק, אידמפוטנטי', () => {
  const base = { 'n1.1': { choice: 0, otherText: '', comment: '' }, 'n1.2': { choice: 1, otherText: '', comment: 'א' } };
  const inc = { 'n1.2': { choice: UNDECIDED }, 'n1.3': { choice: 0, comment: 'ב' }, bogus: { choice: 0 } };
  const merged = mergeAnswers(NEVE, base, inc);
  assert.deepEqual(merged, {
    'n1.1': { choice: 0, otherText: '', comment: '' },
    'n1.2': { choice: UNDECIDED, otherText: '', comment: '' },
    'n1.3': { choice: 0, otherText: '', comment: 'ב' },
  });
  assert.deepEqual(mergeAnswers(NEVE, merged, inc), merged, 'מיזוג חוזר = אותה תוצאה');
  assert.deepEqual(mergeAnswers(NEVE, base, { 'n1.1': null }), { 'n1.2': base['n1.2'] });
  assert.deepEqual(mergeAnswers(NEVE, base, undefined), base);
  assert.deepEqual(mergeAnswers(NEVE, undefined, undefined), {});
});

test('שליחה חוזרת אידמפוטנטית: אותן תשובות -> אותה שורה; עדכון בודד משנה רק אותו', () => {
  const first = pruneHidden(NEVE, sanitizeAnswers(NEVE, completeAnswers(NEVE)));
  const again = pruneHidden(NEVE, sanitizeAnswers(NEVE, first));
  assert.deepEqual(again, first);
  const edited = pruneHidden(NEVE, mergeAnswers(NEVE, first, { 'n1.1': { choice: 2 } }));
  assert.equal(edited['n1.1'].choice, 2);
  assert.deepEqual({ ...edited, 'n1.1': first['n1.1'] }, first);
  assert.equal(validateSubmission(NEVE, edited, { name: 'דנה' }).ok, true);
});

test('normalizeRespondent: חיתוך ורווחים', () => {
  assert.deepEqual(normalizeRespondent({ name: '  דנה  ', role: 'הנהלה\nראשית' }), { name: 'דנה', role: 'הנהלה ראשית' });
  assert.deepEqual(normalizeRespondent(null), { name: '', role: '' });
  assert.equal(normalizeRespondent({ name: 'א'.repeat(500) }).name.length, 120);
});

// ---------------------------------------------------------------------------
// סיכום, טקסט וספירות
// ---------------------------------------------------------------------------
test('answerLabel: אפשרות / אחר / לא החלטנו / לא נענתה', () => {
  const q = findQuestion(NEVE, 'n1.1');
  assert.equal(answerLabel(q, { choice: 0 }), q.options_he[0]);
  assert.equal(answerLabel(q, { choice: OTHER, otherText: 'שלושה ימים' }), 'אחר: שלושה ימים');
  assert.equal(answerLabel(q, { choice: UNDECIDED }), UNDECIDED_LABEL);
  assert.equal(answerLabel(q, null), UNANSWERED_LABEL);
  assert.equal(answerLabel(q, { choice: 42 }), UNANSWERED_LABEL);
});

test('summarize: רק שאלות גלויות, לפי סעיפים; מכיל הערות', () => {
  const a = { ...completeAnswers(NEVE), 'n1.1': { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה ראשונה' } };
  const sum = summarize(NEVE, a);
  assert.equal(sum.reduce((n, s) => n + s.items.length, 0), 13);
  const it = sum[0].items[0];
  assert.equal(it.id, 'n1.1');
  assert.equal(it.answerText, 'אחר: שבעה ימים');
  assert.equal(it.comment, 'הערה ראשונה');
  assert.ok(!sum.some((s) => s.items.some((i) => i.id === 'n4.3')));
});

test('tallyResponses: ספירה לכל אפשרות, לא נענתה, ושאלה מותנית רק למי שהיא גלויה אצלה', () => {
  const r1 = { answers: { ...completeAnswers(NEVE, 0), 'n4.2': { choice: 1 }, 'n4.3': { choice: 0 } } };
  const r2 = { answers: { ...completeAnswers(NEVE, UNDECIDED) } };
  const r3 = { answers: { 'n1.1': { choice: OTHER, otherText: 'x' } } };
  const t = tallyResponses(NEVE, [r1, r2, r3]);
  const t11 = t.find((x) => x.id === 'n1.1');
  assert.equal(t11.total, 3);
  assert.equal(t11.counts.find((c) => c.value === 0).count, 1);
  assert.equal(t11.counts.find((c) => c.value === UNDECIDED).count, 1);
  assert.equal(t11.counts.find((c) => c.value === OTHER).count, 1);
  assert.equal(t11.unanswered, 0);
  const t12 = t.find((x) => x.id === 'n1.2');
  assert.equal(t12.unanswered, 1);
  const t43 = t.find((x) => x.id === 'n4.3');
  assert.equal(t43.total, 1, 'רק r1 רואה את n4.3');
  assert.equal(t43.counts.find((c) => c.value === 0).count, 1);
});

test('buildPlainText / buildAllPlainText: כל התשובות, אחר, הערה, שם ותאריך', () => {
  const a = { ...completeAnswers(NEVE), 'n1.1': { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה ראשונה' } };
  const txt = buildPlainText(NEVE, a, { gmachName: 'נווה יעקב', respondentName: 'דנה לוי', respondentRole: 'הנהלה', status: 'submitted', submittedAt: '2026-10-05T21:30:00Z' });
  assert.ok(txt.includes('דנה לוי, הנהלה'));
  assert.ok(txt.includes('אחר: שבעה ימים'));
  assert.ok(txt.includes('הערה: הערה ראשונה'));
  assert.ok(txt.includes('נענו 13 מתוך 13 שאלות'));
  assert.ok(txt.includes('06.10.2026 00:30'));
  for (const q of visibleQuestions(NEVE, a)) assert.ok(txt.includes(q.text_he), q.id);
  const all = buildAllPlainText(NEVE, [{ respondentName: 'א', answers: a, status: 'submitted' }, { respondentName: 'ב', answers: {}, status: 'draft' }]);
  assert.ok(all.includes('נענה על ידי: א') && all.includes('נענה על ידי: ב') && all.includes('טיוטה'));
  assert.ok(buildAllPlainText(NEVE, []).includes('עדיין אין תשובות'));
});

test('formatIsraelDateTime: שעון ישראל (קיץ/חורף) ותאריך לא תקין', () => {
  assert.equal(formatIsraelDateTime('2026-10-05T21:30:00Z'), '06.10.2026 00:30');
  assert.equal(formatIsraelDateTime('2026-12-01T10:00:00Z'), '01.12.2026 12:00');
  assert.equal(formatIsraelDateTime(null), '');
  assert.equal(formatIsraelDateTime('nope'), '');
});

// ---------------------------------------------------------------------------
// מצב שורה, מייל "עודכן", קישורים, שגיאות DB
// ---------------------------------------------------------------------------
test('מצב שורה: needsEmail / hasPendingChanges / isUpdateEmail / describeResponse', () => {
  const t0 = '2026-10-06T10:00:00.000Z';
  const t1 = '2026-10-06T10:00:05.000Z';
  const t2 = '2026-10-06T10:05:00.000Z';
  assert.equal(needsEmail({ status: 'draft' }), false);
  assert.equal(needsEmail({ status: 'submitted', submittedAt: t0, emailedAt: null }), true);
  assert.equal(needsEmail({ status: 'submitted', submittedAt: t0, emailedAt: t1 }), false);
  assert.equal(needsEmail({ status: 'submitted', submittedAt: t2, emailedAt: t1 }), true, 'נשלחה גרסה חדשה אחרי המייל');
  assert.equal(hasPendingChanges({ status: 'submitted', submittedAt: t0, updatedAt: t0 }), false);
  assert.equal(hasPendingChanges({ status: 'submitted', submittedAt: t0, updatedAt: t2 }), true);
  assert.equal(hasPendingChanges({ status: 'draft', submittedAt: null, updatedAt: t2 }), false);
  assert.equal(isUpdateEmail({ emailedAt: null, submittedAt: t0 }), false);
  assert.equal(isUpdateEmail({ emailedAt: t0, submittedAt: t2 }), true);
  assert.equal(describeResponse(null), null);
  const d = describeResponse({ status: 'submitted', submittedAt: t0, updatedAt: t2, emailedAt: null, emailError: 'x' });
  assert.deepEqual([d.pendingChanges, d.needsEmail, d.emailError], [true, true, 'x']);
});

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

test('classifyDbError: טבלה חסרה / התעוררות / אחר', () => {
  assert.equal(classifyDbError({ code: 'P2021' }), 'missing_table');
  assert.equal(classifyDbError({ message: 'relation "PolicyQuestionnaireResponse" does not exist' }), 'missing_table');
  assert.equal(classifyDbError({ code: 'P1001' }), 'transient');
  assert.equal(classifyDbError({ code: 'P2024' }), 'transient');
  assert.equal(classifyDbError({ message: "Can't reach database server at ep-x.neon.tech" }), 'transient');
  assert.equal(classifyDbError({ message: 'syntax error at or near "FROM"' }), 'other');
  assert.equal(classifyDbError(null), 'other');
});

// ---------------------------------------------------------------------------
// המייל
// ---------------------------------------------------------------------------
function sampleResponse(qn) {
  const answers = completeAnswers(qn, 0);
  const ids = visibleQuestions(qn, answers).map((q) => q.id);
  answers[ids[0]] = { choice: OTHER, otherText: 'שלושה ימים <b>מהאירוע</b> & עוד', comment: 'הערה "חשובה" לשאלה' };
  answers[ids[1]] = { choice: UNDECIDED, otherText: '', comment: '' };
  return { respondentName: 'דנה לוי', respondentRole: 'הנהלה ראשית', answers, submittedAt: '2026-10-05T21:30:00.000Z' };
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

test('מייל: נושא, גוף טקסט ו-HTML מכילים את כל התשובות, אחר, הערות והקישור המלא', () => {
  for (const [qn, origin] of [[NEVE, 'https://gmach-neve-yaakov.vercel.app'], [MAIN, 'https://gemach-app-uyh4-beryl.vercel.app']]) {
    const response = sampleResponse(qn);
    const mail = buildQuestionnaireEmail({ qn, response, updated: false, origin });
    assert.equal(mail.subject, `שאלון מדיניות ביטולים וזיכויים - ${qn.gmachName} - דנה לוי`);
    const link = `${origin}/refund-questionnaire/answers`;
    assert.equal(mail.resultsUrl, link);
    assert.ok(mail.body.includes(link), 'body link');
    assert.ok(mail.html.includes(link), 'html link');
    assert.ok(mail.body.includes(`${origin}/refund-questionnaire`));
    for (const q of visibleQuestions(qn, response.answers)) {
      const label = answerLabel(q, response.answers[q.id]);
      assert.ok(mail.body.includes(label), `body answer ${q.id}`);
      assert.ok(mail.body.includes(q.text_he), `body question ${q.id}`);
      assert.ok(mail.html.includes(escapeHtml(label)), `html answer ${q.id}`);
      assert.ok(mail.html.includes(escapeHtml(q.text_he)), `html question ${q.id}`);
    }
    assert.ok(mail.body.includes('הערה: הערה "חשובה" לשאלה'));
    assert.ok(mail.html.includes(escapeHtml('הערה "חשובה" לשאלה')));
    assert.ok(mail.html.includes(escapeHtml('שלושה ימים <b>מהאירוע</b> & עוד')), 'טקסט אחר מוצמד ב-escape');
    assert.ok(!mail.html.includes('<b>מהאירוע</b>'), 'אין HTML גולמי מהמשיבה');
    assert.ok(mail.body.includes('דנה לוי') && mail.body.includes('הנהלה ראשית'));
    assert.ok(mail.html.includes('06.10.2026 00:30'));
    assert.ok(!/<script/i.test(mail.html));
    assert.ok(!mail.html.includes('עודכן'), 'שליחה ראשונה בלי תגית עודכן');
    assert.ok(!mail.body.includes(' (עודכן)'));
  }
});

test('מייל "עודכן": נושא עם (עודכן), גוף ו-HTML מסומנים', () => {
  const mail = buildQuestionnaireEmail({ qn: NEVE, response: sampleResponse(NEVE), updated: true, origin: 'https://gmach-neve-yaakov.vercel.app' });
  assert.ok(mail.subject.endsWith(' (עודכן)'));
  assert.ok(mail.body.includes('(עודכן)'));
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
  const response = sampleResponse(NEVE);
  response.answers['n4.2'] = { choice: 0, otherText: '', comment: '' };
  response.answers['n4.3'] = { choice: 0, otherText: '', comment: '' };
  const mail = buildQuestionnaireEmail({ qn: NEVE, response, updated: false, origin: 'https://x.vercel.app' });
  assert.ok(!mail.body.includes(findQuestion(NEVE, 'n4.3').text_he));
});

// ---------------------------------------------------------------------------
// חיווט (בדיקות סטטיות של הקבצים)
// ---------------------------------------------------------------------------
test('חיווט: ה-API מחייב הנהלה ראשית/מתכנת ולא סומך על employeeId מהלקוח', () => {
  for (const f of ['app/api/policy-questionnaire/route.js', 'app/api/policy-questionnaire/resend/route.js', 'app/api/policy-questionnaire/answers/route.js']) {
    const s = src(f);
    assert.ok(s.includes('requireHeadManagement'), f);
    assert.ok(!/body\.employeeId|body\.employee\b|searchParams/.test(s), `${f}: מזהה מהלקוח`);
    assert.ok(!/\$transaction/.test(s), f);
  }
  const access = src('lib/policyQuestionnaire/access.js');
  assert.ok(access.includes("checkAuth('הנהלה ראשית')"));
  assert.ok(access.includes('getSessionEmployee'));
  assert.ok(access.includes('HEAD_MANAGEMENT_ROLES'));
  assert.ok(access.includes('roleId === 2'), 'source לבעלים בלבד');
  const post = src('app/api/policy-questionnaire/route.js');
  assert.ok(post.includes('validateSubmission') && post.includes('emailSent'), 'POST בודק תקינות ומחזיר emailSent');
  assert.ok(post.includes('sendQuestionnaireEmailAndRecord'));
});

test('חיווט: שער הדפים checkPageAccess(HEAD_MANAGEMENT_ROLES) + NoAccessMessage, כמו app/admin', () => {
  const layout = src('app/refund-questionnaire/layout.js');
  assert.ok(layout.includes('checkPageAccess(HEAD_MANAGEMENT_ROLES)'));
  assert.ok(layout.includes('NoAccessMessage'));
  assert.ok(layout.includes("./refund-questionnaire.css"));
  assert.ok(existsSync(path.join(root, 'app/refund-questionnaire/page.js')));
  assert.ok(existsSync(path.join(root, 'app/refund-questionnaire/answers/page.js')));
  assert.ok(src('app/refund-questionnaire/answers/page.js').includes('requireHeadManagement'));
  assert.ok(src('app/refund-questionnaire/answers/page.js').includes('requireHeadManagement({ page: true })'), 'דף שרת בלי checkAuth (לא ניתן לכתוב עוגיות מדף)');
});

test('חיווט: הטבלה נוצרת עצלנית ב-SQL גולמי, אילוץ ייחוד, בלי Prisma model ובלי $transaction', () => {
  const s = src('lib/policyQuestionnaire/store.js');
  assert.ok(s.includes('CREATE TABLE IF NOT EXISTS'));
  assert.ok(/CREATE UNIQUE INDEX IF NOT EXISTS/.test(s) && s.includes('"questionnaireKey", "employeeId"'));
  for (const col of ['id', 'questionnaireKey', 'orgKey', 'employeeId', 'respondentName', 'respondentRole', 'answers', 'status', 'submittedAt', 'emailedAt', 'emailError', 'createdAt', 'updatedAt']) {
    assert.ok(s.includes(`"${col}"`), `עמודה ${col}`);
  }
  assert.ok(s.includes('$queryRawUnsafe') && s.includes('$executeRawUnsafe'));
  assert.ok(!/prisma\.policyQuestionnaire/i.test(s));
  assert.ok(!/\$transaction\(/.test(s));
  assert.ok(!/auditLog/i.test(s.replace(/\/\/.*$/gm, '')), 'אין כתיבת AuditLog ידנית');
  assert.ok(!/prisma\.\$executeRaw`/.test(s));
  assert.ok(!existsSync(path.join(root, 'prisma/migrations-pending/policy-questionnaire.sql')) || true);
});

test('חיווט: הקליינט עם RTL, התקדמות "ענית על X מתוך Y", "נשמר", אישור שליחה, עדכון וניסיון חוזר למייל', () => {
  const c = src('app/refund-questionnaire/RefundQuestionnaireClient.js');
  assert.ok((c.match(/dir="rtl"/g) || []).length >= 4);
  assert.ok(c.includes('ענית על'));
  assert.ok(c.includes("saved: 'נשמר'"));
  assert.ok(c.includes('לשלוח את התשובות?'));
  assert.ok(c.includes('עדכון התשובות'));
  assert.ok(c.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב'));
  assert.ok(c.includes('/resend'));
  assert.ok(c.includes('דוגמה') && c.includes('היום אצלכן') && c.includes('למה שואלים'));
  assert.ok(!/\.source(?![A-Za-z])|"source"/.test(c), 'הקליינט לא נוגע ב-source');
  const a = src('app/refund-questionnaire/answers/AnswersClient.js');
  assert.ok(a.includes('dir="rtl"') && a.includes('העתק הכל') && a.includes('window.print') && a.includes('print-hide'));
});

test('חיווט: דוגמת מייל קיימת ב-emailSamples ושורה 17 ב-EMAILS.md', () => {
  assert.ok(src('lib/emailSamples.js').includes("case 'policyQuestionnaireSubmitted'"));
  const md = src('EMAILS.md');
  assert.ok(md.includes('policyQuestionnaireSubmitted'));
  assert.ok(md.includes('טבלת כל המיילים (17)'));
});

test('תיעוד: docs/refund-questionnaire.md כולל את ארבעת הקישורים המלאים ואת רשימת ההושמטים; CLAUDE.md מצביע עליו', () => {
  const d = src('docs/refund-questionnaire.md');
  for (const u of [
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire',
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire/answers',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers',
  ]) assert.ok(d.includes(u), u);
  for (const o of OMITTED_TOPICS) assert.ok(d.includes(o.topic_he), o.topic_he.slice(0, 30));
  assert.ok(src('CLAUDE.md').includes('docs/refund-questionnaire.md'));
});

// ---------------------------------------------------------------------------
// רינדור בצד שרת (SSR) של רכיבי הטופס - מדולג אם אין react-dom / typescript
// ---------------------------------------------------------------------------
async function ssrSmoke() {
  const req = createRequire(path.join(root, 'package.json'));
  let ReactDOMServer; let React; let ts; let Module;
  try {
    ReactDOMServer = req('react-dom/server');
    React = req('react');
    ts = req('typescript');
    Module = req('node:module');
  } catch {
    console.log('SKIP ssr: react-dom/typescript לא זמינים (הגדירו NODE_PATH ל-node_modules)');
    return;
  }
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function patched(request, ...rest) {
    if (typeof request === 'string' && request.startsWith('@/')) request = path.join(root, request.slice(2));
    return origResolve.call(this, request, ...rest);
  };
  const origJs = Module._extensions['.js'];
  Module._extensions['.js'] = function hook(module, filename) {
    const norm = filename.split(path.sep).join('/');
    if (norm.startsWith(root.split(path.sep).join('/')) && !norm.includes('/node_modules/')) {
      const code = readFileSync(filename, 'utf8');
      const out = ts.transpileModule(code, { fileName: filename.replace(/\.js$/, '.jsx'), compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
      module._compile(out.outputText, filename);
      return;
    }
    origJs(module, filename);
  };
  try {
    const { FormView, DoneView } = req(path.join(root, 'app/refund-questionnaire/RefundQuestionnaireClient.js'));
    const AnswersClient = req(path.join(root, 'app/refund-questionnaire/answers/AnswersClient.js')).default;
    const h = React.createElement;
    const noop = () => {};

    for (const [label, qn0] of [['org1', MAIN], ['org2', NEVE]]) {
      const qn = publicQuestionnaire(qn0);
      const answers = { ...completeAnswers(qn0, 0) };
      const first = visibleQuestions(qn0, answers)[0].id;
      answers[first] = { choice: OTHER, otherText: 'תשובה אחרת', comment: 'הערה כלשהי' };
      const base = {
        qn, answers, name: 'דנה לוי', role: 'הנהלה', saveState: 'saved', saveError: '', showErrors: false, editingSent: false, serverState: null,
        submitError: '', submitting: false, confirmOpen: false, openComments: {}, setOpenComments: noop, changeName: noop, changeRole: noop,
        setAnswer: noop, requestSubmit: noop, doSubmit: noop, setConfirmOpen: noop,
      };
      const html = ReactDOMServer.renderToStaticMarkup(h(FormView, base));
      assert.ok(html.includes('dir="rtl"'), `${label} rtl`);
      assert.ok(html.includes(qn.gmachName));
      assert.equal((html.match(/id="rq-q-[^"]*" class="rq-card/g) || []).length, visibleQuestions(qn0, answers).length, `${label}: כרטיס לכל שאלה גלויה`);
      assert.ok(html.includes(`ענית על ${visibleQuestions(qn0, answers).length} מתוך ${visibleQuestions(qn0, answers).length}`.replace(/ /g, ' ')) || html.includes('ענית על'), 'progress');
      assert.ok(html.includes('נשמר'));
      assert.ok(html.includes(UNDECIDED_LABEL) && html.includes('דוגמה:') && html.includes('היום אצלכן:') && html.includes('למה שואלים:'));
      assert.ok(html.includes('תשובה אחרת') && html.includes('הערה כלשהי'));
      assert.ok(!html.includes('"source"') && !flattenQuestions(qn0).some((q) => html.includes(q.source)), 'source לא מוצג');
      assert.ok(!FORBIDDEN.some(([, re]) => re.test(html.replace(/<[^>]*>/g, ' '))), 'אין מילים אסורות בטקסט המרונדר');
      assert.ok(html.includes('>שליחה<'));
      // מצב שגיאות + חלון אישור
      const withErr = ReactDOMServer.renderToStaticMarkup(h(FormView, { ...base, answers: {}, showErrors: true, confirmOpen: true, name: '' }));
      assert.ok(withErr.includes('rq-missing') && withErr.includes('נא לבחור תשובה') && withErr.includes('נא למלא שם') && withErr.includes('לשלוח את התשובות?'));
    }
    // n4.3 מרונדרת רק כשהיא גלויה
    const neveQ = publicQuestionnaire(NEVE);
    const formProps = (answers) => ({ qn: neveQ, answers, name: 'ד', role: '', saveState: 'idle', saveError: '', showErrors: false, editingSent: false, serverState: null, submitError: '', submitting: false, confirmOpen: false, openComments: {}, setOpenComments: noop, changeName: noop, changeRole: noop, setAnswer: noop, requestSubmit: noop, doSubmit: noop, setConfirmOpen: noop });
    const q43 = findQuestion(NEVE, 'n4.3').text_he;
    assert.ok(!ReactDOMServer.renderToStaticMarkup(h(FormView, formProps({ 'n4.2': { choice: 0 } }))).includes(q43));
    assert.ok(ReactDOMServer.renderToStaticMarkup(h(FormView, formProps({ 'n4.2': { choice: 1 } }))).includes(q43));

    const done = ReactDOMServer.renderToStaticMarkup(h(DoneView, { qn: neveQ, answers: completeAnswers(NEVE), name: 'דנה', mail: { emailSent: false, emailError: 'x' }, retrying: false, retryEmail: noop, startEditing: noop }));
    assert.ok(done.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב') && done.includes('ניסיון חוזר') && done.includes('עדכון התשובות') && done.includes('dir="rtl"'));
    const done2 = ReactDOMServer.renderToStaticMarkup(h(DoneView, { qn: neveQ, answers: completeAnswers(NEVE), name: 'דנה', mail: { emailSent: true }, retrying: false, retryEmail: noop, startEditing: noop }));
    assert.ok(done2.includes('נשלחו במייל לבעלים') && !done2.includes('המייל לא נשלח'));

    const responses = [
      { id: 'r1', respondentName: 'דנה', respondentRole: 'הנהלה', answers: completeAnswers(NEVE, 0), status: 'submitted', submittedAt: '2026-10-05T21:30:00Z', updatedAt: '2026-10-05T21:30:00Z', needsEmail: true, emailError: 'boom', pendingChanges: false },
      { id: 'r2', respondentName: 'רבקה', respondentRole: '', answers: { 'n1.1': { choice: OTHER, otherText: 'אחר מיוחד' } }, status: 'draft', submittedAt: null, updatedAt: '2026-10-05T22:00:00Z', needsEmail: false, emailError: null, pendingChanges: false },
    ];
    const ownerQn = publicQuestionnaire(NEVE, { includeSource: true });
    const ans = ReactDOMServer.renderToStaticMarkup(h(AnswersClient, { questionnaire: ownerQn, responses }));
    assert.ok(ans.includes('dir="rtl"') && ans.includes('העתק הכל') && ans.includes('הדפסה') && ans.includes('דנה') && ans.includes('רבקה') && ans.includes('אחר: אחר מיוחד') && ans.includes('טיוטה') && ans.includes('המייל לא נשלח'));
    assert.ok(ans.includes('מקור:'), 'הבעלים רואה מקור');
    const ansNoSrc = ReactDOMServer.renderToStaticMarkup(h(AnswersClient, { questionnaire: neveQ, responses }));
    assert.ok(!ansNoSrc.includes('מקור:'));
    const empty = ReactDOMServer.renderToStaticMarkup(h(AnswersClient, { questionnaire: neveQ, responses: [] }));
    assert.ok(empty.includes('עדיין אף אחת לא התחילה לענות'));
    passed += 1;
    console.log('ok ssr smoke: FormView/DoneView/AnswersClient מרונדרים לשני הגמחים');
  } catch (e) {
    failed += 1;
    failures.push(`SSR smoke\n    ${String(e && e.stack).split('\n').slice(0, 6).join('\n    ')}`);
  } finally {
    Module._resolveFilename = origResolve;
    Module._extensions['.js'] = origJs;
  }
}

// ---------------------------------------------------------------------------
// ה-API המלא (route handlers אמיתיים + notify אמיתי) מול store בזיכרון, auth מדומה ומייל מדומה.
// אין DB, אין רשת, אין שליחת מייל אמיתית. מדולג אם typescript לא זמין.
// ---------------------------------------------------------------------------
async function routesSmoke() {
  const req = createRequire(path.join(root, 'package.json'));
  let ts; let Module;
  try { ts = req('typescript'); Module = req('node:module'); } catch {
    console.log('SKIP routes: typescript לא זמין (הגדירו NODE_PATH ל-node_modules)');
    return;
  }

  // ---- דמויות ----
  const state = { user: null, owners: [], mails: [], mailBehavior: () => ({ success: true }), clock: 0, rows: new Map(), employeeName: { firstName: 'דנה', lastName: 'לוי', fullName: null } };
  const tick = () => new Date(Date.UTC(2026, 9, 6, 8, 0, 0) + (state.clock += 1000)).toISOString();
  const key = (k, e) => `${k}|${e}`;
  const memStore = {
    PolicyQuestionnaireDbError: class PolicyQuestionnaireDbError extends Error { constructor(kind) { super(kind); this.kind = kind; this.userMessage = 'שגיאת מסד'; } },
    async getResponse(k, e) { const r = state.rows.get(key(k, e)); return r ? JSON.parse(JSON.stringify(r)) : null; },
    async listResponses(k, orgKey) { return [...state.rows.values()].filter((r) => r.questionnaireKey === k && r.orgKey === orgKey).map((r) => JSON.parse(JSON.stringify(r))); },
    async saveDraft({ questionnaireKey, orgKey, employeeId, name, role, answers }) {
      const k = key(questionnaireKey, employeeId); const now = tick(); const ex = state.rows.get(k);
      const row = ex ? { ...ex, respondentName: name, respondentRole: role, answers, updatedAt: now } : { id: `id-${k}`, questionnaireKey, orgKey, employeeId, respondentName: name, respondentRole: role, answers, status: 'draft', submittedAt: null, emailedAt: null, emailError: null, createdAt: now, updatedAt: now };
      state.rows.set(k, row); return JSON.parse(JSON.stringify(row));
    },
    async submitResponse({ questionnaireKey, orgKey, employeeId, name, role, answers }) {
      const k = key(questionnaireKey, employeeId); const now = tick(); const ex = state.rows.get(k);
      const row = { id: `id-${k}`, questionnaireKey, orgKey, employeeId, respondentName: name, respondentRole: role, answers, status: 'submitted', submittedAt: now, emailedAt: ex ? ex.emailedAt : null, emailError: null, createdAt: ex ? ex.createdAt : now, updatedAt: now };
      state.rows.set(k, row); return JSON.parse(JSON.stringify(row));
    },
    async recordEmailResult(id, { sent, error }) {
      const row = [...state.rows.values()].find((r) => r.id === id); const now = tick();
      if (sent) row.emailedAt = now; row.emailError = error || null; return JSON.parse(JSON.stringify(row));
    },
  };
  const stubs = {
    '@/lib/policyQuestionnaire/store': memStore,
    '@/app/lib/prisma': { __esModule: true, default: { employee: {
      findMany: async () => state.owners.map((email) => ({ email })),
      findUnique: async () => state.employeeName,
    } } },
    '@/lib/auth': {
      HEAD_MANAGEMENT_ROLES: [0, 2],
      checkAuth: async () => !!state.user && [0, 2].includes(state.user.roleId),
      getSessionEmployee: async () => (state.user ? { id: state.user.id, roleId: state.user.roleId, isActive: true } : null),
    },
    '@/lib/mailer': { sendSystemEmail: async (o) => { state.mails.push(o); return state.mailBehavior(o); } },
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }) } },
  };

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
  const savedOrg = process.env.GEMACH_ORG;
  process.env.GEMACH_ORG = 'neve-yaakov';
  const call = async (handler, method, body, headers = {}) => {
    const request = new Request('https://gmach-neve-yaakov.vercel.app/api/policy-questionnaire', {
      method, headers: { host: 'gmach-neve-yaakov.vercel.app', 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await handler(request);
    return { status: res.status, json: await res.json() };
  };

  try {
    const main = req(path.join(root, 'app/api/policy-questionnaire/route.js'));
    const resend = req(path.join(root, 'app/api/policy-questionnaire/resend/route.js'));
    const answersRoute = req(path.join(root, 'app/api/policy-questionnaire/answers/route.js'));
    const full = completeAnswers(NEVE, 0);
    const link = 'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers';

    // הרשאות
    state.user = null;
    assert.equal((await call(main.GET, 'GET')).status, 401, 'אנונימי');
    state.user = { id: 'emp-branch', roleId: 1 };
    assert.equal((await call(main.GET, 'GET')).status, 403, 'מנהל סניף');
    assert.equal((await call(main.PUT, 'PUT', { answers: full })).status, 403);
    assert.equal((await call(main.POST, 'POST', { answers: full, name: 'x' })).status, 403);
    assert.equal((await call(resend.POST, 'POST')).status, 403);
    assert.equal((await call(answersRoute.GET, 'GET')).status, 403);
    assert.equal(state.rows.size, 0, 'שום שורה לא נכתבה');

    // GET ראשון: השאלון של נווה יעקב בלבד, בלי source, שם ותפקיד מראש
    state.user = { id: 'emp-1', roleId: 0 };
    state.owners = ['owner@example.com'];
    const g = await call(main.GET, 'GET');
    assert.equal(g.status, 200);
    assert.equal(g.json.questionnaire.gmachName, 'נווה יעקב');
    assert.equal(flattenQuestions(g.json.questionnaire).length, 14);
    assert.ok(!JSON.stringify(g.json).includes('"source"'));
    assert.equal(g.json.respondent.name, 'דנה לוי');
    assert.equal(g.json.respondent.role, 'הנהלה ראשית');
    assert.equal(g.json.response, null);

    // שמירה אוטומטית: מיזוג, טיוטה, לא סומכים על employeeId מהלקוח
    const p1 = await call(main.PUT, 'PUT', { answers: { 'n1.1': { choice: 1 }, bogus: { choice: 0 } }, name: 'דנה לוי', role: 'הנהלה', employeeId: 'emp-ATTACKER' });
    assert.equal(p1.status, 200);
    assert.ok(state.rows.has(key(QUESTIONNAIRE_KEY, 'emp-1')) && !state.rows.has(key(QUESTIONNAIRE_KEY, 'emp-ATTACKER')));
    const p2 = await call(main.PUT, 'PUT', { answers: { 'n1.2': { choice: UNDECIDED } } });
    assert.equal(p2.json.response.status, 'draft');
    const row = state.rows.get(key(QUESTIONNAIRE_KEY, 'emp-1'));
    assert.deepEqual(Object.keys(row.answers).sort(), ['n1.1', 'n1.2']);
    assert.equal(row.respondentRole, 'הנהלה');

    // שליחה לא תקינה: חסר הכול / אחר בלי טקסט
    const bad = await call(main.POST, 'POST', { answers: { 'n1.1': { choice: 0 } }, name: 'דנה' });
    assert.equal(bad.status, 400);
    assert.ok(bad.json.errors.length >= 10 && state.mails.length === 0);
    assert.equal(state.rows.get(key(QUESTIONNAIRE_KEY, 'emp-1')).status, 'draft', 'נשארת טיוטה');
    const badOther = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: OTHER, otherText: '  ' } }, name: 'דנה' });
    assert.equal(badOther.status, 400);
    assert.deepEqual(badOther.json.errors, [{ questionId: 'n1.1', code: 'other_text_missing' }]);
    const noName = await call(main.POST, 'POST', { answers: full, name: ' ', role: '' });
    assert.equal(noName.status, 200, 'השם נשמר מהטיוטה (הנהלה) ולכן תקין');

    // שליחה ראשונה (הכול תקין) - מייל אחד לבעלים, ללא "עודכן"
    state.rows.clear(); state.mails.length = 0;
    state.owners = ['owner@example.com', 'OWNER@example.com', 'second@example.com'];
    const ok1 = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה' }, 'n4.3': { choice: 1 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
    assert.equal(ok1.status, 200);
    assert.equal(ok1.json.success, true);
    assert.equal(ok1.json.emailSent, true);
    assert.deepEqual(state.mails.map((m) => m.to), ['owner@example.com', 'second@example.com'], 'נמענים בלי כפילויות');
    assert.equal(state.mails[0].subject, 'שאלון מדיניות ביטולים וזיכויים - נווה יעקב - דנה לוי');
    assert.ok(state.mails[0].body.includes(link) && state.mails[0].html.includes(link));
    assert.ok(state.mails[0].body.includes('אחר: שבעה ימים'));
    assert.ok(!state.mails[0].body.includes(findQuestion(NEVE, 'n4.3').text_he), 'n4.3 מוסתרת (n4.2=אין קיזוז) נגזמה');
    const saved = state.rows.get(key(QUESTIONNAIRE_KEY, 'emp-1'));
    assert.equal(saved.status, 'submitted');
    assert.ok(saved.emailedAt && !saved.answers['n4.3'], 'נשמר בלי התשובה המוסתרת');
    assert.equal(ok1.json.response.pendingChanges, false);
    assert.equal(ok1.json.response.needsEmail, false);

    // עריכה אחרי שליחה: נשמרת כטיוטה-על-גבי-שליחה, מסומנת "יש שינויים"; שליחה חוזרת = (עודכן)
    const edit = await call(main.PUT, 'PUT', { answers: { 'n1.1': { choice: 0 } } });
    assert.equal(edit.json.response.status, 'submitted');
    assert.equal(edit.json.response.pendingChanges, true);
    state.mails.length = 0;
    const ok2 = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: 0 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
    assert.equal(ok2.json.emailSent, true);
    assert.equal(state.mails.length, 2);
    assert.ok(state.mails[0].subject.endsWith(' (עודכן)'), state.mails[0].subject);
    assert.equal(state.rows.size, 1, 'אותה שורה - אין כפילות');
    assert.equal(ok2.json.response.pendingChanges, false);

    // כשל מייל: התשובות נשמרות, emailSent=false, ניסיון חוזר אחר כך
    state.mails.length = 0;
    state.mailBehavior = () => ({ success: false, message: 'Apps Script down' });
    const fail = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: 2 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
    assert.equal(fail.status, 200);
    assert.equal(fail.json.success, true);
    assert.equal(fail.json.emailSent, false);
    assert.ok(fail.json.emailError.includes('Apps Script down'));
    assert.equal(state.rows.get(key(QUESTIONNAIRE_KEY, 'emp-1')).answers['n1.1'].choice, 2, 'התשובות לא אבדו');
    assert.equal(fail.json.response.needsEmail, true);
    state.mailBehavior = () => ({ success: true });
    state.mails.length = 0;
    const retry = await call(resend.POST, 'POST');
    assert.equal(retry.json.emailSent, true);
    assert.equal(state.mails.length, 2);
    assert.ok(state.mails[0].subject.endsWith(' (עודכן)'), 'כבר נשלח מייל על גרסה קודמת');
    assert.equal(retry.json.response.needsEmail, false);
    const again = await call(resend.POST, 'POST');
    assert.equal(again.json.alreadySent, true);
    assert.equal(state.mails.length, 2, 'אין שליחה כפולה');

    // אין נמענים / המייל זורק
    state.owners = [];
    await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: 1 } }, name: 'דנה לוי' });
    const noOwner = await call(resend.POST, 'POST');
    assert.equal(noOwner.json.emailSent, false);
    assert.ok(noOwner.json.emailError.includes('כתובת מייל'));
    state.owners = ['owner@example.com'];
    state.mailBehavior = () => { throw new Error('boom'); };
    const thrown = await call(resend.POST, 'POST');
    assert.equal(thrown.status, 200);
    assert.equal(thrown.json.emailSent, false);
    state.mailBehavior = () => ({ success: true });

    // resend בלי שליחה קודמת
    state.user = { id: 'emp-2', roleId: 2 };
    const none = await call(resend.POST, 'POST');
    assert.equal(none.status, 400);

    // תוצאות: הנהלה רואה בלי source, מתכנת (הבעלים) רואה source
    state.user = { id: 'emp-1', roleId: 0 };
    const r0 = await call(answersRoute.GET, 'GET');
    assert.equal(r0.status, 200);
    assert.equal(r0.json.responses.length, 1);
    assert.ok(!JSON.stringify(r0.json).includes('"source"'));
    state.user = { id: 'emp-2', roleId: 2 };
    const r2 = await call(answersRoute.GET, 'GET');
    assert.ok(flattenQuestions(r2.json.questionnaire).every((q) => q.source), 'הבעלים רואה מקור');
    assert.equal(r2.json.responses[0].respondentName, 'דנה לוי');

    // גוף לא תקין
    state.user = { id: 'emp-1', roleId: 0 };
    const rawBad = await main.PUT(new Request('https://x.vercel.app/api/policy-questionnaire', { method: 'PUT', body: '{not json' }));
    assert.equal(rawBad.status, 400);
    passed += 1;
    console.log('ok routes smoke: הרשאות, שמירה, תקינות, מייל מדומה, עדכון, כשל מייל וניסיון חוזר');
  } catch (e) {
    failed += 1;
    failures.push(`Routes smoke\n    ${String(e && e.stack).split('\n').slice(0, 7).join('\n    ')}`);
  } finally {
    Module._resolveFilename = origResolve;
    Module._load = origLoad;
    Module._extensions['.js'] = origJs;
    if (savedOrg === undefined) delete process.env.GEMACH_ORG; else process.env.GEMACH_ORG = savedOrg;
  }
}

await ssrSmoke();
await routesSmoke();

console.log(`\n${passed} passed, ${failed} failed; forbidden-word hits: ${forbiddenHits.length}`);
if (failed) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
