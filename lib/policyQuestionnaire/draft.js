// lib/policyQuestionnaire/draft.js - טיוטת השאלון בדפדפן (localStorage). אין שמירה בשרת עד לשליחה הסופית.
// כל גישה לאחסון עטופה ב-try/catch (חלון פרטי / אחסון חסום / מכסה מלאה) והדף עובד גם בלי אחסון. הפונקציות מקבלות את האחסון כפרמטר,
// כך שנבדקות ב-node עם אחסון מדומה (scripts/test_policy_questionnaire.mjs). ייבוא יחסי עם סיומת .js בכוונה.

import { sanitizeAnswers, normalizeRespondent } from './logic.js';

const PREFIX = 'rq-draft:';
const VERSION = 1;

/** מפתח הטיוטה: מפתח השאלון + מזהה העובדת המחוברת (כך שלכל עובדת במחשב משותף יש טיוטה נפרדת). */
export function draftKey(questionnaireKey, employeeId) {
  return `${PREFIX}${questionnaireKey}:${employeeId}`;
}

/** אחסון הדפדפן, או null אם חסום. */
export function browserStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** שומר טיוטה. מחזיר true אם נשמרה. */
export function saveDraft(storage, key, { answers, name, role }, now = Date.now()) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify({ v: VERSION, savedAt: now, answers: answers || {}, name: name || '', role: role || '' }));
    return true;
  } catch {
    return false;
  }
}

/** טוען טיוטה ומנקה אותה מול השאלון (מזהים וערכים חוקיים בלבד). מחזיר { answers, name, role, savedAt } או null. */
export function loadDraft(storage, key, qn) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || d.v !== VERSION) return null;
    const who = normalizeRespondent({ name: d.name, role: d.role });
    const answers = sanitizeAnswers(qn, d.answers);
    if (!Object.keys(answers).length && !who.name && !who.role) return null;
    return { answers, name: who.name, role: who.role, savedAt: Number(d.savedAt) || 0 };
  } catch {
    return null;
  }
}

/** מוחק טיוטה (אחרי שליחה סופית, או כשבוחרים להתחיל מחדש). */
export function clearDraft(storage, key) {
  try {
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
