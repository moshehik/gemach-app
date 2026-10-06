// בדיקות לשאלון המדיניות (ביטולים וזיכויים) להנהלות: lib/policyQuestionnaire/*, המייל, החיווט של ה-API והדפים.
// התשובות נשמרות בשרשור דיווח-תקלה (ErrorReport + ErrorReportReply) - בלי טבלה ובלי DDL; כאן הכול מול Prisma מדומה בזיכרון.
// ללא DB, ללא רשת, ללא שליחת מייל. הרצה: node scripts/test_policy_questionnaire.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקת הרינדור בצד שרת (SSR) צריכה react-dom + typescript (node_modules של הפרויקט, או NODE_PATH); בלעדיהם היא מדולגת ומודפס SKIP.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUESTIONNAIRE_KEY, getQuestionnaire, getQuestionnaireByOrgKey, orgKeyForOrg, orgForOrgKey, OMITTED_TOPICS,
} from '../lib/policyQuestionnaire/questions-refunds-2026-10.js';
import {
  UNDECIDED, OTHER, UNDECIDED_LABEL, OTHER_LABEL, UNANSWERED_LABEL, MAX_TEXT, KNOWN_SITE_ORIGINS,
  flattenQuestions, findQuestion, stripReportIds, optionsForQuestion, publicQuestion, publicQuestionnaire,
  isQuestionVisible, visibleQuestions, normalizeAnswer, sanitizeAnswers, pruneHidden, isAnswered,
  computeProgress, validateSubmission, answerLabel, summarize, tallyResponses, formatIsraelDateTime,
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

test('שליחה חוזרת אידמפוטנטית: אותן תשובות -> אותן תשובות; עדכון בודד משנה רק אותו', () => {
  const first = pruneHidden(NEVE, sanitizeAnswers(NEVE, completeAnswers(NEVE)));
  const again = pruneHidden(NEVE, sanitizeAnswers(NEVE, first));
  assert.deepEqual(again, first);
  const edited = pruneHidden(NEVE, sanitizeAnswers(NEVE, { ...first, 'n1.1': { choice: 2 } }));
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
  const response = sampleResponse(NEVE);
  response.answers['n4.2'] = { choice: 0, otherText: '', comment: '' };
  response.answers['n4.3'] = { choice: 0, otherText: '', comment: '' };
  const mail = buildQuestionnaireEmail({ qn: NEVE, response, updated: false, origin: 'https://x.vercel.app' });
  assert.ok(!mail.body.includes(findQuestion(NEVE, 'n4.3').text_he));
});

// ---------------------------------------------------------------------------
// השרשור: הדפסת התשובות לטקסט של תגובה, פענוח חזרה, וקיבוץ לפי משיבה
// ---------------------------------------------------------------------------
function variedAnswers(qn) {
  const out = {};
  const qs = flattenQuestions(qn);
  qs.forEach((q, i) => {
    const n = q.options_he.length;
    const kind = i % 4;
    out[q.id] = {
      choice: kind === 0 ? 0 : kind === 1 ? n - 1 : kind === 2 ? UNDECIDED : (q.allowOther ? OTHER : 0),
      otherText: kind === 3 && q.allowOther ? `פירוט ${q.id}` : '',
      comment: i % 3 === 0 ? `הערה ל-${q.id}` : '',
    };
  });
  return out;
}

test('שרשור: הדפסה ופענוח הלוך-חזור על כל תשובה אפשרית בשני הגמחים (אפשרות, אחר, לא החלטנו, הערה)', () => {
  for (const qn of [MAIN, NEVE]) {
    const answers = pruneHidden(qn, sanitizeAnswers(qn, variedAnswers(qn)));
    const text = renderSubmissionText(qn, answers, { respondentName: 'דנה לוי', respondentRole: 'הנהלה ראשית', submittedAt: '2026-10-05T21:30:00Z', updated: false });
    const parsed = parseSubmissionText(qn, text);
    assert.deepEqual(parsed.answers, answers, `${qn.orgKey} round trip`);
    assert.deepEqual(parsed.unparsed, []);
    assert.equal(parsed.respondentName, 'דנה לוי');
    assert.equal(parsed.respondentRole, 'הנהלה ראשית');
    assert.equal(parsed.updated, false);
    assert.equal(parsed.sentAtText, '06.10.2026 00:30');
    // כל שאלה גלויה, כל תשובה וכל הערה מופיעות בטקסט
    for (const q of visibleQuestions(qn, answers)) {
      assert.ok(text.includes(`${q.id} ${q.text_he}`), `question ${q.id}`);
      assert.ok(text.includes(`תשובה: ${answerLabel(q, answers[q.id])}`), `answer ${q.id}`);
      if (answers[q.id].comment) assert.ok(text.includes(`הערה: ${answers[q.id].comment}`), `comment ${q.id}`);
    }
  }
});

test('שרשור: כל אפשרות של כל שאלה (כולל "אחר" ו"לא החלטנו") נפענחת בחזרה לאותו אינדקס', () => {
  for (const qn of [MAIN, NEVE]) {
    for (const q of flattenQuestions(qn)) {
      for (const o of optionsForQuestion(q)) {
        const a = { choice: o.value, otherText: o.kind === 'other' ? 'טקסט אחר' : '', comment: '' };
        const text = renderSubmissionText(qn, { [q.id]: a }, { respondentName: 'א' });
        // שאלה מותנית (n4.3) מוצגת רק כשהשולטת נענתה; הבדיקה הזו על השאלות הגלויות בלי תשובה אחרת
        if (!isQuestionVisible(qn, q, { [q.id]: a })) continue;
        assert.deepEqual(parseSubmissionText(qn, text).answers[q.id], a, `${q.id} / ${o.label}`);
      }
    }
  }
});

test('שרשור: טקסט רב-שורתי ב"אחר" ובהערה (כולל שורה ריקה ושורה שנראית כמו שאלה) נשמר, ושאלה מוסתרת לא נכתבת', () => {
  const answers = {
    'n1.1': { choice: OTHER, otherText: 'שורה א\nשורה ב', comment: 'הערה א\n\nn1.2 זה לא שאלה\nתשובה: גם זה לא' },
    'n1.2': { choice: 0, otherText: '', comment: '' },
    'n4.2': { choice: 0, otherText: '', comment: '' },
    'n4.3': { choice: 0, otherText: '', comment: '' }, // מוסתרת: n4.2 = 0
  };
  const text = renderSubmissionText(NEVE, pruneHidden(NEVE, answers), { respondentName: 'דנה' });
  assert.ok(!text.includes(`n4.3 ${findQuestion(NEVE, 'n4.3').text_he}`), 'n4.3 לא נכתבת');
  const p = parseSubmissionText(NEVE, text);
  assert.deepEqual(p.answers['n1.1'], { choice: OTHER, otherText: 'שורה א\nשורה ב', comment: 'הערה א\n\nn1.2 זה לא שאלה\nתשובה: גם זה לא' });
  assert.equal(p.answers['n1.2'].choice, 0);
  assert.ok(!('n4.3' in p.answers));
  assert.deepEqual(p.unparsed, []);
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

test('שרשור: תשובה שנוסחה לא מזוהה (אחרי שינוי נוסח אפשרות) מדווחת ב-unparsed ולא נכנסת לתשובות', () => {
  const a = completeAnswers(NEVE);
  const text = renderSubmissionText(NEVE, a, { respondentName: 'דנה' }).replace(`תשובה: ${findQuestion(NEVE, 'n1.1').options_he[0]}`, 'תשובה: נוסח שלא קיים במאגר');
  const p = parseSubmissionText(NEVE, text);
  assert.deepEqual(p.unparsed, ['n1.1']);
  assert.ok(!('n1.1' in p.answers));
  assert.equal(p.answers['n1.2'].choice, 0);
});

test('שרשור: threadMarker, כותרת קבועה ותוכן פותח', () => {
  assert.equal(THREAD_TITLE, '📋 שאלון מדיניות ביטולים וזיכויים');
  assert.equal(threadMarker(QUESTIONNAIRE_KEY), 'policy-questionnaire:refunds-2026-10');
  assert.notEqual(threadMarker('refunds-2027-01'), threadMarker(QUESTIONNAIRE_KEY));
  const intro = buildThreadIntro(NEVE);
  assert.ok(intro.startsWith(THREAD_TITLE) && intro.includes('נווה יעקב') && intro.includes('/refund-questionnaire/answers') && intro.includes('עדכון'));
});

test('groupSubmissions: לפי משיבה, האחרונה במלואה + גרסאות קודמות מהחדשה לישנה, מדלג על תגובות חופשיות, החדשה ראשונה', () => {
  const mk = (id, employeeId, createdAt, o = {}) => ({
    id, employeeId, employeeName: o.employeeName || '', createdAt,
    text: o.text || renderSubmissionText(NEVE, o.answers || completeAnswers(NEVE), { respondentName: o.name || 'דנה', respondentRole: 'הנהלה', submittedAt: createdAt, updated: !!o.updated }),
  });
  const replies = [
    mk('r3', 'e1', '2026-10-06T10:00:00Z', { updated: true, answers: { ...completeAnswers(NEVE), 'n1.1': { choice: 1, otherText: '', comment: '' } } }),
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
  assert.equal(d.latest.answers['n1.1'].choice, 1);
  assert.deepEqual(d.earlier.map((e) => e.id), ['r1']);
  assert.equal(groups[1].count, 1, 'תגובה חופשית לא נספרת');
  assert.equal(groups[1].latest.id, 'r2');
  assert.deepEqual(groupSubmissions(NEVE, []), []);
  assert.deepEqual(groupSubmissions(NEVE, null), []);
  // tally על השליחה האחרונה של כל משיבה
  const tally = tallyResponses(NEVE, groups.map((g) => g.latest));
  assert.equal(tally.find((t) => t.id === 'n1.1').total, 3);
  assert.equal(tally.find((t) => t.id === 'n1.1').counts.find((c) => c.value === 1).count, 1);
  assert.equal(joinSubmissionTexts(['א', '', 'ב']), 'א\n\n------------------------------\n\nב');
});

test('classifyDbError: התעוררות / אחר (אין יותר "טבלה חסרה")', () => {
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

test('אין DDL ואין SQL גולמי בשום קובץ של הפיצ\'ר, וה-store כותב רק דרך prisma.errorReport / prisma.errorReportReply', () => {
  const files = featureFiles();
  assert.ok(files.length >= 12, `נמצאו ${files.length} קבצים`);
  for (const f of files) {
    const s = src(f); // כולל הערות: גם בהערות אסור (הבדיקה מחמירה בכוונה)
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
  assert.ok(store.includes("@/app/lib/prisma"), 'הלקוח המשותף (עם תוסף ה-AuditLog)');
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

test('מייל: החלטה - מסלול התגובה הרגיל לא שולח מייל, ולכן מייל השאלון הוא היחיד (מסלול אחד, בלי כפילות)', () => {
  const reply = src('app/api/error-report/reply/route.js');
  assert.ok(!/sendSystemEmail|mailer|sendProgrammerEmail|emailTemplates/.test(reply), 'אם זה ישתנה - יש להסיר את מייל השאלון (ר\' docs/refund-questionnaire.md, "המייל לבעלים")');
  // המסלול היחיד ששולח מייל בפיצ'ר: notify.js (ולא ה-store, לא הדפים, לא ה-API של התוצאות)
  const senders = featureFiles().filter((f) => /sendSystemEmail/.test(src(f)));
  assert.deepEqual(senders, ['lib/policyQuestionnaire/notify.js']);
  assert.ok(!/mailer|sendQuestionnaireEmail/.test(src('lib/policyQuestionnaire/store.js')));
  assert.equal((src('app/api/policy-questionnaire/route.js').match(/sendQuestionnaireEmail\(/g) || []).length, 1, 'POST שולח פעם אחת');
  assert.ok(!/sendQuestionnaireEmail/.test(src('app/api/policy-questionnaire/answers/route.js')));
  // השרשור לא נכתב דרך המסלולים הרגילים (שולחים "דיווח תקלה חדש" ו-repository_dispatch)
  for (const f of featureFiles()) assert.ok(!/api\/error-report|repository_dispatch|GH_DISPATCH/.test(src(f).replace(/\/\/.*$/gm, '')), f);
  const md = src('docs/refund-questionnaire.md');
  assert.ok(md.includes('המייל האוטומטי היחיד') && md.includes('לא שולח שום מייל'));
  assert.ok(src('EMAILS.md').includes('policyQuestionnaireSubmitted'));
});

test('נראות השרשור בחלון הדיווחים (כפי שנקרא בקוד): מתכנת רואה הכול, אחרים רק דיווחים על שמם; תגובה של לא-מתכנת לא שולחת מייל', () => {
  const list = src('app/api/error-report/route.js');
  assert.ok(list.includes("const isProgrammer = employee.roleId === 2;") && list.includes("const whereClause = isProgrammer ? {} : { employeeId: employee.id };"),
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
  assert.ok(access.includes('roleId === 2'), 'source לבעלים בלבד');
  assert.ok(route.includes('validateSubmission') && route.includes('emailSent'));
  const layout = src('app/refund-questionnaire/layout.js');
  assert.ok(layout.includes('checkPageAccess(HEAD_MANAGEMENT_ROLES)') && layout.includes('NoAccessMessage') && layout.includes('./refund-questionnaire.css'));
  assert.ok(src('app/refund-questionnaire/answers/page.js').includes('requireHeadManagement({ page: true })'), 'דף שרת בלי checkAuth (לא ניתן לכתוב עוגיות מדף)');
  assert.ok(src('lib/menu/pageLabels.js').includes("'/refund-questionnaire': 'שאלון ביטולים וזיכויים'") && src('lib/menu/pageLabels.js').includes("'/refund-questionnaire/answers': 'תשובות שאלון ביטולים וזיכויים'"));
});

test('חיווט: הקליינט עם RTL, טיוטה בדפדפן בלבד, אישור שליחה, עדכון וניסיון חוזר למייל', () => {
  const c = src('app/refund-questionnaire/RefundQuestionnaireClient.js');
  assert.ok((c.match(/dir="rtl"/g) || []).length >= 4);
  assert.ok(c.includes('ענית על') && c.includes('לשלוח את התשובות?') && c.includes('עדכון התשובות'));
  assert.ok(c.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב') && c.includes('/resend'));
  assert.ok(c.includes('הטיוטה נשמרת רק בדפדפן הזה עד השליחה'));
  assert.ok(!/method:\s*'PUT'|'PUT'/.test(c), 'אין שמירה אוטומטית בשרת');
  assert.ok(c.includes('lib/policyQuestionnaire/draft'));
  assert.ok(c.includes('דוגמה') && c.includes('היום אצלכן') && c.includes('למה שואלים'));
  assert.ok(!/\.source(?![A-Za-z])|"source"/.test(c), 'הקליינט לא נוגע ב-source');
  const draft = src('lib/policyQuestionnaire/draft.js');
  const fnBodies = draft.split('export function').slice(1);
  for (const body of fnBodies.filter((b) => !b.startsWith(' draftKey'))) assert.ok(/try \{/.test(body), 'כל גישה לאחסון בתוך try/catch');
  const a = src('app/refund-questionnaire/answers/AnswersClient.js');
  assert.ok(a.includes('dir="rtl"') && a.includes('העתק הכל') && a.includes('window.print') && a.includes('print-hide') && a.includes('גרסאות קודמות') && a.includes('<details'));
});

test('חיווט: דוגמת מייל קיימת ב-emailSamples ושורה 17 ב-EMAILS.md; הקטלוג מפרט שהוא המייל היחיד', () => {
  assert.ok(src('lib/emailSamples.js').includes("case 'policyQuestionnaireSubmitted'"));
  const md = src('EMAILS.md');
  assert.ok(md.includes('policyQuestionnaireSubmitted') && md.includes('טבלת כל המיילים (17)'));
  assert.ok(EMAIL_CATALOG.policyQuestionnaireSubmitted.trigger.includes('המייל היחיד'));
});

test('תיעוד: docs/refund-questionnaire.md כולל את ארבעת הקישורים, איפה התשובות נשמרות, מי רואה, וההושמטים; CLAUDE.md מצביע עליו', () => {
  const d = src('docs/refund-questionnaire.md');
  for (const u of [
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire',
    'https://gemach-app-uyh4-beryl.vercel.app/refund-questionnaire/answers',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire',
    'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers',
  ]) assert.ok(d.includes(u), u);
  for (const o of OMITTED_TOPICS) assert.ok(d.includes(o.topic_he), o.topic_he.slice(0, 30));
  assert.ok(d.includes('שרשור דיווח-תקלה אחד לכל גמ"ח') && d.includes('בלי טבלה חדשה, בלי שינוי סכימה ובלי DDL'));
  assert.ok(d.includes('policy-questionnaire:refunds-2026-10') && d.includes('needsHuman = true') && d.includes('עדכון') && d.includes('localStorage'));
  assert.ok(d.includes('מי יכולה לענות ומי רואה') && d.includes('מנהלות רגילות'));
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
test('טיוטה: מפתח לפי שאלון ועובדת; שמירה, טעינה (עם ניקוי מול השאלון) ומחיקה', () => {
  assert.equal(draftKey(QUESTIONNAIRE_KEY, 'emp-1'), 'rq-draft:refunds-2026-10:emp-1');
  assert.notEqual(draftKey(QUESTIONNAIRE_KEY, 'emp-1'), draftKey(QUESTIONNAIRE_KEY, 'emp-2'));
  const st = fakeStorage();
  const key = draftKey(QUESTIONNAIRE_KEY, 'emp-1');
  assert.equal(loadDraft(st, key, NEVE), null, 'אין טיוטה');
  assert.equal(saveDraft(st, key, { answers: { 'n1.1': { choice: 1, otherText: '', comment: 'א' }, bogus: { choice: 0 } }, name: ' דנה ', role: 'הנהלה' }, 12345), true);
  const d = loadDraft(st, key, NEVE);
  assert.deepEqual(d.answers, { 'n1.1': { choice: 1, otherText: '', comment: 'א' } }, 'מזהה לא מוכר נזרק');
  assert.equal(d.name, 'דנה');
  assert.equal(d.role, 'הנהלה');
  assert.equal(d.savedAt, 12345);
  assert.equal(clearDraft(st, key), true);
  assert.equal(loadDraft(st, key, NEVE), null);
  assert.equal(st._m.size, 0);
});

test('טיוטה: הדף עובד בלי אחסון - אחסון חסום/זורק/ריק/פגום/גרסה אחרת לא זורקים ומחזירים ברירת מחדל', () => {
  const key = draftKey(QUESTIONNAIRE_KEY, 'emp-1');
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
  st.setItem(key, JSON.stringify({ v: 99, answers: { 'n1.1': { choice: 0 } } }));
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
      const answers = pruneHidden(NEVE, completeAnswers(NEVE, 0));
      const args = { qn: NEVE, questionnaireKey: QUESTIONNAIRE_KEY, respondent, answers };

      assert.deepEqual(await store.listSubmissions(QUESTIONNAIRE_KEY), { threadId: null, replies: [] }, 'אין שרשור עד השליחה הראשונה');
      assert.equal(await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-1'), null);
      assert.equal(state.reports.length, 0, 'קריאה לא יוצרת שרשור');

      // שליחה ראשונה: שרשור חדש + תגובה
      const s1 = await store.submitAnswers({ ...args, employeeId: 'emp-1' });
      assert.equal(state.reports.length, 1);
      assert.equal(state.replies.length, 1);
      const th = state.reports[0];
      assert.equal(th.title, '📋 שאלון מדיניות ביטולים וזיכויים');
      assert.equal(th.queryParams, 'policy-questionnaire:refunds-2026-10');
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
      assert.deepEqual(parseSubmissionText(NEVE, r1.text).answers, answers, 'כל התשובות ברות פענוח מהתגובה');
      for (const q of visibleQuestions(NEVE, answers)) assert.ok(r1.text.includes(`${q.id} ${q.text_he}`) && r1.text.includes(answerLabel(q, answers[q.id])));

      // שליחה חוזרת (אידמפוטנטיות): אותו שרשור, תגובה חדשה מסומנת "עדכון", התגובה הישנה לא נערכת
      const before = JSON.stringify(state.replies[0]);
      const s2 = await store.submitAnswers({ ...args, employeeId: 'emp-1', answers: { ...answers, 'n1.1': { choice: 2, otherText: '', comment: '' } } });
      assert.equal(state.reports.length, 1, 'לא נוצר שרשור שני');
      assert.equal(state.replies.length, 2);
      assert.equal(JSON.stringify(state.replies[0]), before, 'תגובה ישנה לא נערכה');
      assert.equal(s2.threadId, s1.threadId);
      assert.equal(s2.updated, true);
      assert.ok(state.replies[1].text.split('\n')[1].startsWith('עדכון'));
      assert.equal(parseSubmissionText(NEVE, state.replies[1].text).updated, true);
      assert.equal(parseSubmissionText(NEVE, state.replies[1].text).answers['n1.1'].choice, 2);

      // משיבה אחרת: אותו שרשור (ה-employeeId שלו לא משתנה), שליחה ראשונה שלה = בלי "עדכון"
      th.isReadByProgrammer = true; th.needsHuman = false; th.status = 'ARCHIVED'; th.isHandled = true;
      const s3 = await store.submitAnswers({ ...args, employeeId: 'emp-2', respondent: { name: 'רבקה', role: 'הנהלה ראשית' } });
      assert.equal(state.reports.length, 1);
      assert.equal(state.reports[0].employeeId, 'emp-1');
      assert.equal(s3.updated, false);
      assert.equal(state.reports[0].isReadByProgrammer, false, 'שליחה חדשה מסמנת שרשור כלא נקרא');
      assert.equal(state.reports[0].needsHuman, true, 'הדגל נקבע מחדש (מתכנת שענה מאפס אותו)');
      assert.equal(state.reports[0].status, 'OPEN', 'שרשור בארכיון חוזר לפתוח');
      assert.equal(state.reports[0].isHandled, false);

      // קריאות
      const last = await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-1');
      assert.equal(last.count, 2);
      assert.equal(last.id, state.replies[1].id);
      assert.equal(await store.getLastSubmission(QUESTIONNAIRE_KEY, 'emp-nobody'), null);
      // תגובה חופשית בשרשור (למשל של המתכנת) לא נספרת כשליחה
      state.replies.push({ id: 'free', errorReportId: th.id, employeeId: 'prog', isProgrammer: true, text: 'שאלה חופשית', isQuestion: true, createdAt: new Date(Date.UTC(2026, 9, 6, 9, 0, 0)) });
      const list = await store.listSubmissions(QUESTIONNAIRE_KEY);
      assert.equal(list.threadId, th.id);
      assert.equal(list.replies.length, 3);
      assert.ok(list.replies.every((r) => r.text.startsWith(THREAD_TITLE)));
      assert.deepEqual(list.replies.map((r) => r.employeeId), ['emp-1', 'emp-1', 'emp-2']);
      // סבב אחר = שרשור אחר
      assert.equal(await store.getLastSubmission('refunds-2099-01', 'emp-1'), null);

      // שני שרשורים שנוצרו בטעות באותו רגע: ממשיכים בוותיק
      state.reports.push({ ...state.reports[0], id: 'rep-dup', createdAt: new Date(Date.UTC(2026, 9, 7)) });
      assert.equal((await store.listSubmissions(QUESTIONNAIRE_KEY)).threadId, th.id);

      // עמידות: התעוררות של Neon בקריאה = ניסיון חוזר אחד; שגיאה אחרת = בלי ניסיון חוזר; כתיבה לא מנוסה שוב
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

      // כשל בעדכון דגלי השרשור לא מבטל שליחה שכבר נשמרה
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
      const full = completeAnswers(NEVE, 0);
      const link = 'https://gmach-neve-yaakov.vercel.app/refund-questionnaire/answers';
      assert.equal(main.PUT, undefined, 'אין שמירה אוטומטית בשרת');

      // הרשאות: אנונימי / מנהלת רגילה = שום כתיבה, שום מייל
      sys.user = null;
      assert.equal((await call(main.GET, 'GET')).status, 401);
      assert.equal((await call(main.POST, 'POST', { answers: full, name: 'x' })).status, 401);
      sys.user = { id: 'emp-branch', roleId: 1 };
      for (const [h, m, b] of [[main.GET, 'GET'], [main.POST, 'POST', { answers: full, name: 'x' }], [resend.POST, 'POST'], [answersRoute.GET, 'GET']]) assert.equal((await call(h, m, b)).status, 403);
      assert.equal(db.reports.length + db.replies.length, 0, 'שום דבר לא נכתב');
      assert.equal(sys.mails.length, 0);

      // GET ראשון: השאלון של נווה יעקב בלבד, בלי source, שם ותפקיד מראש, בלי תשובות
      sys.user = { id: 'emp-1', roleId: 0 };
      const g = await call(main.GET, 'GET');
      assert.equal(g.status, 200);
      assert.equal(g.json.questionnaire.gmachName, 'נווה יעקב');
      assert.equal(flattenQuestions(g.json.questionnaire).length, 14);
      assert.ok(!JSON.stringify(g.json).includes('"source"'));
      assert.equal(g.json.respondent.name, 'דנה לוי');
      assert.equal(g.json.respondent.role, 'הנהלה ראשית');
      assert.deepEqual(g.json.answers, {});
      assert.equal(g.json.submission, null);
      assert.equal(g.json.questionnaireKey, 'refunds-2026-10');
      assert.equal(db.reports.length, 0, 'GET לא יוצר שרשור');

      // שליחה לא תקינה: שום כתיבה ושום מייל
      const bad = await call(main.POST, 'POST', { answers: { 'n1.1': { choice: 0 } }, name: 'דנה' });
      assert.equal(bad.status, 400);
      assert.ok(bad.json.errors.length >= 10);
      assert.equal((await call(main.POST, 'POST', { name: 'דנה' })).status, 400, 'בלי answers');
      assert.equal((await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: OTHER, otherText: '  ' } }, name: 'דנה' })).status, 400);
      assert.equal(db.reports.length + db.replies.length, 0);
      assert.equal(sys.mails.length, 0);
      const rawBad = await main.POST(new Request('https://x.vercel.app/api/policy-questionnaire', { method: 'POST', body: '{not json' }));
      assert.equal(rawBad.status, 400);

      // שליחה ראשונה: שרשור + תגובה אחת + מייל אחד לכל נמען (בלי כפילויות)
      db.owners = ['owner@example.com', 'OWNER@example.com', 'second@example.com'];
      const ok1 = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: OTHER, otherText: 'שבעה ימים', comment: 'הערה' }, 'n4.3': { choice: 1 }, bogus: { choice: 0 } }, name: 'דנה לוי', role: 'הנהלה ראשית', employeeId: 'emp-ATTACKER' });
      assert.equal(ok1.status, 200);
      assert.equal(ok1.json.success, true);
      assert.equal(ok1.json.emailSent, true);
      assert.equal(db.reports.length, 1);
      assert.equal(db.replies.length, 1);
      assert.equal(db.replies[0].employeeId, 'emp-1', 'הזהות מהעוגייה, לא מהגוף');
      assert.equal(db.reports[0].employeeId, 'emp-1');
      assert.deepEqual(sys.mails.map((m) => m.to), ['owner@example.com', 'second@example.com'], 'מייל אחד לכל נמען, בלי כפילויות');
      assert.equal(sys.mails[0].subject, 'שאלון מדיניות ביטולים וזיכויים - נווה יעקב - דנה לוי');
      assert.ok(sys.mails[0].body.includes(link) && sys.mails[0].html.includes(link));
      assert.ok(sys.mails[0].body.includes('אחר: שבעה ימים'));
      assert.ok(sys.mails[0].body.startsWith(db.replies[0].text.split('\n')[0]), 'גוף המייל הוא אותו טקסט של התגובה');
      assert.ok(db.replies[0].text.includes('תשובה: אחר: שבעה ימים') && db.replies[0].text.includes('הערה: הערה'));
      assert.ok(!db.replies[0].text.includes(`n4.3 ${findQuestion(NEVE, 'n4.3').text_he}`), 'n4.3 מוסתרת (n4.2=אין קיזוז) נגזמה');
      assert.ok(!db.replies[0].text.includes('bogus'));
      assert.ok(!sys.mails[0].body.includes('עדכון - זו גרסה'));
      assert.equal(ok1.json.updated, false);

      // GET אחרי שליחה: השליחה האחרונה נקראת מהשרשור (לעדכון התשובות)
      const g2 = await call(main.GET, 'GET');
      assert.equal(g2.json.answers['n1.1'].choice, OTHER);
      assert.equal(g2.json.answers['n1.1'].otherText, 'שבעה ימים');
      assert.equal(g2.json.answers['n1.1'].comment, 'הערה');
      assert.equal(g2.json.submission.count, 1);
      assert.equal(g2.json.respondent.name, 'דנה לוי');
      // משיבה אחרת לא רואה את התשובות של דנה
      sys.user = { id: 'emp-2', roleId: 0 };
      const g3 = await call(main.GET, 'GET');
      assert.deepEqual(g3.json.answers, {});
      assert.equal(g3.json.submission, null);
      assert.equal(g3.json.respondent.name, 'רבקה כהן');
      sys.user = { id: 'emp-1', roleId: 0 };

      // שליחה חוזרת: אותו שרשור, תגובה חדשה "עדכון", מייל "(עודכן)"
      sys.mails.length = 0;
      const ok2 = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: 0 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
      assert.equal(ok2.json.updated, true);
      assert.equal(db.reports.length, 1, 'שרשור אחד לגמ"ח');
      assert.equal(db.replies.length, 2);
      assert.ok(db.replies[1].text.split('\n')[1].startsWith('עדכון'));
      assert.equal(sys.mails.length, 2);
      assert.ok(sys.mails[0].subject.endsWith(' (עודכן)'));
      assert.equal((await call(main.GET, 'GET')).json.submission.count, 2);

      // כשל מייל: התשובות כבר בשרשור, emailSent=false; ניסיון חוזר שולח שוב את האחרונה בלבד ואינו כותב בשרשור
      sys.mails.length = 0;
      sys.mailBehavior = () => ({ success: false, message: 'Apps Script down' });
      const fail = await call(main.POST, 'POST', { answers: { ...full, 'n1.1': { choice: 2 } }, name: 'דנה לוי', role: 'הנהלה ראשית' });
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
      assert.ok(sys.mails[0].body.includes(findQuestion(NEVE, 'n1.1').options_he[2]), 'השליחה האחרונה');
      assert.equal(db.replies.length, repliesBefore, 'ניסיון חוזר לא כותב בשרשור');
      // אין נמענים / המייל זורק
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
      // resend בלי שליחה קודמת
      sys.user = { id: 'emp-2', roleId: 2 };
      assert.equal((await call(resend.POST, 'POST')).status, 400);

      // תוצאות: הנהלה רואה בלי source; מתכנת (הבעלים) רואה source; כולן מקובצות לפי משיבה
      db.replies.push({ id: 'free', errorReportId: db.reports[0].id, employeeId: 'prog', isProgrammer: true, text: 'שאלה חופשית', isQuestion: true, createdAt: new Date(Date.UTC(2026, 9, 6, 12, 0, 0)) });
      await call(main.POST, 'POST', { answers: full, name: 'רבקה כהן', role: 'הנהלה' }); // כרגע המשתמשת היא emp-2 (roleId 2)
      sys.user = { id: 'emp-1', roleId: 0 };
      const r0 = await call(answersRoute.GET, 'GET');
      assert.equal(r0.status, 200);
      assert.equal(r0.json.threadFound, true);
      assert.deepEqual(r0.json.respondents.map((r) => r.name).sort(), ['דנה לוי', 'רבקה כהן']);
      const dana = r0.json.respondents.find((r) => r.name === 'דנה לוי');
      assert.equal(dana.count, 3);
      assert.equal(dana.earlier.length, 2);
      assert.ok(dana.latest.text.startsWith(THREAD_TITLE) && dana.latest.answers['n1.1'].choice === 2);
      assert.ok(dana.earlier.every((e) => e.text && !('answers' in e)));
      assert.ok(!JSON.stringify(r0.json).includes('"source"'));
      assert.ok(!JSON.stringify(r0.json).includes('שאלה חופשית'), 'תגובה חופשית בשרשור לא נכנסת לתוצאות');
      sys.user = { id: 'emp-2', roleId: 2 };
      const r2 = await call(answersRoute.GET, 'GET');
      assert.ok(flattenQuestions(r2.json.questionnaire).every((q) => q.source), 'הבעלים רואה מקור');

      // הגמ"ח הראשי: אותו קוד, השאלות של מכובד, שרשור משלו (DB נפרד)
      process.env.GEMACH_ORG = 'main';
      const mainDb = makeFakePrisma();
      Object.assign(db, { reports: mainDb.state.reports, replies: mainDb.state.replies });
      sys.user = { id: 'emp-1', roleId: 0 };
      const gm = await call(main.GET, 'GET');
      assert.equal(gm.json.questionnaire.gmachName, 'מכובד');
      assert.equal(flattenQuestions(gm.json.questionnaire).length, 8);
      const okm = await call(main.POST, 'POST', { answers: completeAnswers(MAIN), name: 'דנה', role: '' });
      assert.equal(okm.status, 200);
      assert.ok(db.replies[0].text.includes('מכובד') && db.replies[0].text.includes('m1.1 '));
      assert.ok(sys.mails.at(-1).subject.includes('מכובד'));
      process.env.GEMACH_ORG = 'neve-yaakov';

      // שגיאת מסד: הודעה בעברית, בלי 500 גולמי
      db.failNext = { op: 'report.findFirst', error: new Error('boom') };
      const dbErr = await call(main.GET, 'GET');
      assert.equal(dbErr.status, 503);
      assert.ok(dbErr.json.error.includes('נסו שוב'));
      passed += 1;
      console.log('ok routes smoke: הרשאות, שרשור אחד, "עדכון", מייל אחד, כשל מייל וניסיון חוזר, תוצאות לפי משיבה, שני גמחים');
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

      for (const [label, qn0] of [['org1', MAIN], ['org2', NEVE]]) {
        const qn = publicQuestionnaire(qn0);
        const answers = { ...completeAnswers(qn0, 0) };
        const first = visibleQuestions(qn0, answers)[0].id;
        answers[first] = { choice: OTHER, otherText: 'תשובה אחרת', comment: 'הערה כלשהי' };
        const base = {
          qn, answers, name: 'דנה לוי', role: 'הנהלה', saveState: 'saved', showErrors: false, editingSent: false, submission: null, draftInfo: null, discardDraft: noop,
          submitError: '', submitting: false, confirmOpen: false, openComments: {}, setOpenComments: noop, changeName: noop, changeRole: noop,
          setAnswer: noop, requestSubmit: noop, doSubmit: noop, setConfirmOpen: noop,
        };
        const html = render(h(FormView, base));
        assert.ok(html.includes('dir="rtl"'), `${label} rtl`);
        assert.ok(html.includes(qn.gmachName));
        assert.equal((html.match(/id="rq-q-[^"]*" class="rq-card/g) || []).length, visibleQuestions(qn0, answers).length, `${label}: כרטיס לכל שאלה גלויה`);
        assert.ok(html.includes('ענית על') && html.includes('נשמר בדפדפן'));
        assert.ok(html.includes('הטיוטה נשמרת רק בדפדפן הזה עד השליחה'));
        assert.ok(html.includes(UNDECIDED_LABEL) && html.includes('דוגמה:') && html.includes('היום אצלכן:') && html.includes('למה שואלים:'));
        assert.ok(html.includes('תשובה אחרת') && html.includes('הערה כלשהי'));
        assert.ok(!html.includes('"source"') && !flattenQuestions(qn0).some((q) => html.includes(q.source)), 'source לא מוצג');
        assert.ok(!FORBIDDEN.some(([, re]) => re.test(html.replace(/<[^>]*>/g, ' '))), 'אין מילים אסורות בטקסט המרונדר');
        assert.ok(html.includes('>שליחה<'));
        const withErr = render(h(FormView, { ...base, answers: {}, showErrors: true, confirmOpen: true, name: '' }));
        assert.ok(withErr.includes('rq-missing') && withErr.includes('נא לבחור תשובה') && withErr.includes('נא למלא שם') && withErr.includes('לשלוח את התשובות?'));
        // שחזור טיוטה, עדכון אחרי שליחה, ואחסון חסום
        const restored = render(h(FormView, { ...base, draftInfo: { savedAt: Date.UTC(2026, 9, 6, 8, 0) }, editingSent: true, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 1 } }));
        assert.ok(restored.includes('שוחזרה טיוטה שנשמרה בדפדפן הזה') && restored.includes('מחיקת הטיוטה והתחלה מחדש') && restored.includes('06.10.2026 00:30') && restored.includes('התשובות כבר נשלחו פעם אחת'));
        const noStore = render(h(FormView, { ...base, saveState: 'nostore' }));
        assert.ok(noStore.includes('הדפדפן לא מאפשר לשמור טיוטה'));
      }
      const neveQ = publicQuestionnaire(NEVE);
      const formProps = (answers) => ({ qn: neveQ, answers, name: 'ד', role: '', saveState: 'idle', showErrors: false, editingSent: false, submission: null, draftInfo: null, discardDraft: noop, submitError: '', submitting: false, confirmOpen: false, openComments: {}, setOpenComments: noop, changeName: noop, changeRole: noop, setAnswer: noop, requestSubmit: noop, doSubmit: noop, setConfirmOpen: noop });
      const q43 = findQuestion(NEVE, 'n4.3').text_he;
      assert.ok(!render(h(FormView, formProps({ 'n4.2': { choice: 0 } }))).includes(q43));
      assert.ok(render(h(FormView, formProps({ 'n4.2': { choice: 1 } }))).includes(q43));

      const done = render(h(DoneView, { qn: neveQ, answers: completeAnswers(NEVE), name: 'דנה', mail: { emailSent: false, emailError: 'x' }, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 1 }, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done.includes('התשובות נשמרו, המייל לא נשלח - ננסה שוב') && done.includes('ניסיון חוזר') && done.includes('עדכון התשובות') && done.includes('dir="rtl"') && done.includes('נשלח ב-06.10.2026 00:30'));
      const done2 = render(h(DoneView, { qn: neveQ, answers: completeAnswers(NEVE), name: 'דנה', mail: { emailSent: true }, submission: null, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done2.includes('נשלחו במייל לבעלים') && !done2.includes('המייל לא נשלח'));
      const done3 = render(h(DoneView, { qn: neveQ, answers: completeAnswers(NEVE), name: 'דנה', mail: null, submission: { submittedAt: '2026-10-05T21:30:00Z', count: 2, partial: true }, retrying: false, retryEmail: noop, startEditing: noop }));
      assert.ok(done3.includes('אלה התשובות האחרונות ששלחת') && done3.includes('לא נטענו מחדש') && !done3.includes('המייל לא נשלח'));

      // דף התוצאות (רכיב + דף שרת)
      const ownerQn = publicQuestionnaire(NEVE, { includeSource: true });
      const mk = (id, employeeId, createdAt, o = {}) => ({ id, employeeId, employeeName: '', createdAt, text: renderSubmissionText(NEVE, o.answers || completeAnswers(NEVE, 0), { respondentName: o.name || 'דנה', respondentRole: 'הנהלה', submittedAt: createdAt, updated: !!o.updated }) });
      const groups = groupSubmissions(NEVE, [
        mk('a1', 'e1', '2026-10-06T08:00:00Z'),
        mk('a2', 'e1', '2026-10-06T10:00:00Z', { updated: true, answers: { ...completeAnswers(NEVE, 0), 'n1.1': { choice: OTHER, otherText: 'אחר מיוחד', comment: '' } } }),
        mk('b1', 'e2', '2026-10-06T09:00:00Z', { name: 'רבקה' }),
      ]);
      const respondents = groups.map((g) => ({ key: g.key, name: g.name, role: g.role, count: g.count, latest: g.latest, earlier: g.earlier.map((e) => ({ id: e.id, createdAt: e.createdAt, text: e.text, updated: e.updated })) }));
      const ans = render(h(AnswersClient, { questionnaire: ownerQn, respondents, threadFound: true }));
      assert.ok(ans.includes('dir="rtl"') && ans.includes('העתק הכל') && ans.includes('הדפסה') && ans.includes('דנה') && ans.includes('רבקה') && ans.includes('אחר: אחר מיוחד'));
      assert.ok(ans.includes('גרסאות קודמות (1)') && ans.includes('<details') && ans.includes('2 שליחות'), 'האחרונה במלואה + גרסאות קודמות מקופלות');
      assert.ok(ans.includes('עדכון') && ans.includes(THREAD_TITLE) && ans.includes("דיווח על שגיאות"));
      assert.ok(ans.includes('מקור:'), 'הבעלים רואה מקור');
      assert.ok(!render(h(AnswersClient, { questionnaire: neveQ, respondents, threadFound: true })).includes('מקור:'));
      const empty = render(h(AnswersClient, { questionnaire: neveQ, respondents: [], threadFound: false }));
      assert.ok(empty.includes('עדיין אף אחת לא שלחה תשובות') && empty.includes('השרשור ייווצר בשליחה הראשונה'));
      // שליחה שלא כל תשובותיה זוהו: מוצג הטקסט המלא
      const partialGroups = groupSubmissions(NEVE, [{ id: 'p1', employeeId: 'e3', employeeName: '', createdAt: '2026-10-06T08:00:00Z', text: renderSubmissionText(NEVE, completeAnswers(NEVE, 0), { respondentName: 'שרה' }).replace(`תשובה: ${findQuestion(NEVE, 'n1.1').options_he[0]}`, 'תשובה: נוסח ישן') }]);
      const partialHtml = render(h(AnswersClient, { questionnaire: neveQ, threadFound: true, respondents: partialGroups.map((g) => ({ key: g.key, name: g.name, role: g.role, count: g.count, latest: g.latest, earlier: [] })) }));
      assert.ok(partialHtml.includes('לא כל התשובות זוהו') && partialHtml.includes('נוסח ישן') && partialHtml.includes('rq-raw'));

      const page = req(path.join(root, 'app/refund-questionnaire/answers/page.js')).default;
      ssrState.payload = () => ({ questionnaire: ownerQn, threadFound: true, respondents });
      const pageHtml = render(await page());
      assert.ok(pageHtml.includes('דנה') && pageHtml.includes('העתק הכל'));
      ssrState.payload = () => { throw new (stubs['@/lib/policyQuestionnaire/store'].PolicyQuestionnaireDbError)('transient'); };
      const errHtml = render(await page());
      assert.ok(errHtml.includes('callout-danger') && errHtml.includes('שגיאת מסד'));
      passed += 1;
      console.log('ok ssr smoke: FormView/DoneView/AnswersClient/דף התוצאות מרונדרים לשני הגמחים');
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
