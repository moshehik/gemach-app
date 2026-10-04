// כותרת AI קצרה לכל דיווח שגיאה (בקשת הבעלים 4.10.2026, חלון "דיווח על שגיאות" בעיצוב B).
//
// מצב: מוכן אבל כבוי. שני תנאים להפעלה, שניהם בידי הבעלים:
//   1. העמודה ErrorReport."aiTitle" קיימת ב-DB - prisma/migrations-pending/2026-10-04-error-report-ai-title.sql (לא הורץ).
//   2. ההגדרה SystemSetting error_report_ai_title = 'true' (בלי שורה / כל ערך אחר = כבוי).
// כל עוד אחד מהם חסר - אין קריאה ל-Gemini, אין כתיבה, והחלון מציג כותרת חלופית (5 המילים הראשונות של התיאור).
//
// למה SQL גולמי ולא prisma.errorReport: העמודה לא נוספה ל-prisma/schema.prisma בכוונה - שדה בסכימה בלי עמודה ב-DB היה
// מפיל כל שאילתה על ErrorReport (Prisma בוחר את כל העמודות). לכן קריאה וכתיבה של "aiTitle" דרך $queryRawUnsafe /
// $executeRawUnsafe בלבד, והיעדר העמודה (42703 undefined_column / P2010 / "column ... does not exist") מזוהה ונזכר
// לכמה דקות (אותו דפוס כמו lib/schedule/marks.js עם ScheduleStageMark) - בלי שאילתה כושלת בכל טעינה.
// הפעלה: docs/error-report-new-design-2026-10-04.md, סעיף "כותרת אוטומטית".
import { buildReportTitlePrompt, generateChatTitle } from './ai/chatTitle.js';

export const AI_TITLE_SETTING_KEY = 'error_report_ai_title';
export const COLUMN_RECHECK_MS = 5 * 60 * 1000;

let columnMissingUntil = 0;
export function resetAiTitleColumnState() { columnMissingUntil = 0; }
export const isAiTitleColumnKnownMissing = (now = Date.now()) => now < columnMissingUntil;

export function isMissingColumnError(e) {
  if (!e) return false;
  const code = String(e.code || '');
  const metaCode = String((e.meta && (e.meta.code || e.meta.dbCode)) || '');
  const msg = String(e.message || (e.meta && e.meta.message) || '');
  if (code === '42703' || metaCode === '42703') return true;
  return /aiTitle/.test(msg) && /does not exist|undefined column|42703/i.test(msg);
}

function markMissing(e) {
  columnMissingUntil = Date.now() + COLUMN_RECHECK_MS;
  console.warn(`error report aiTitle: column unavailable (${e && (e.code || e.message)}) - AI titles off until the SQL in prisma/migrations-pending is applied`);
}

/** ההגדרה פעילה רק כשהערך הוא בדיוק 'true'. getSetting: async (key) => value|null (לבדיקות: מוזרק). */
export async function isAiTitleEnabled(getSetting) {
  try {
    const v = await getSetting(AI_TITLE_SETTING_KEY);
    return String(v ?? '').trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/** הטקסט שנשלח ל-Gemini: התיאור בלבד, בלי שורות הצעדים ובלי בלוק האלמנטים המסומנים. */
export function descriptionForTitle(userText) {
  let s = String(userText || '');
  const steps = s.lastIndexOf('[הפעולות שבוצעו לפני התקלה:');
  if (steps !== -1) s = s.slice(0, steps);
  const picked = s.indexOf('[אלמנטים מסומנים:');
  if (picked !== -1) s = s.slice(0, picked);
  return s.trim();
}

/**
 * יוצר ושומר כותרת AI לדיווח חדש. מחזיר את הכותרת או null. לא זורק לעולם.
 * deps: { prisma, getSetting, generate } - generate: async (prompt) => string (ב-route: generateContent של lib/ai/gemini.js).
 */
export async function generateAndStoreAiTitle(reportId, userText, deps) {
  const { prisma, getSetting, generate } = deps || {};
  try {
    if (!reportId || !prisma || isAiTitleColumnKnownMissing()) return null;
    if (!(await isAiTitleEnabled(getSetting))) return null;
    const desc = descriptionForTitle(userText);
    if (!desc) return null;
    const title = await generateChatTitle(desc, generate, undefined, buildReportTitlePrompt);
    if (!title) return null;
    try {
      await prisma.$executeRawUnsafe('UPDATE "ErrorReport" SET "aiTitle" = $1 WHERE "id" = $2', title, reportId);
    } catch (e) {
      if (isMissingColumnError(e)) { markMissing(e); return null; }
      throw e;
    }
    return title;
  } catch (e) {
    console.error('error report aiTitle: generation failed', e && e.message);
    return null;
  }
}

/**
 * מוסיף aiTitle לרשימת דיווחים (GET /api/error-report) כשההגדרה פעילה והעמודה קיימת: שאילתה אחת לפי מזהים.
 * בלי הגדרה / בלי עמודה / כשל - הרשימה חוזרת כמו שהיא (בלי השדה), והחלון מציג כותרת חלופית.
 */
export async function attachAiTitles(reports, deps) {
  const { prisma, getSetting } = deps || {};
  try {
    if (!Array.isArray(reports) || !reports.length || !prisma || isAiTitleColumnKnownMissing()) return reports;
    if (!(await isAiTitleEnabled(getSetting))) return reports;
    const ids = reports.map((r) => r.id).filter(Boolean);
    let rows;
    try {
      rows = await prisma.$queryRawUnsafe('SELECT "id", "aiTitle" FROM "ErrorReport" WHERE "id" = ANY($1::text[])', ids);
    } catch (e) {
      if (isMissingColumnError(e)) { markMissing(e); return reports; }
      throw e;
    }
    const byId = new Map((rows || []).map((r) => [r.id, r.aiTitle]));
    for (const r of reports) {
      const t = byId.get(r.id);
      if (typeof t === 'string' && t.trim()) r.aiTitle = t.trim();
    }
    return reports;
  } catch (e) {
    console.error('error report aiTitle: read failed', e && e.message);
    return reports;
  }
}
