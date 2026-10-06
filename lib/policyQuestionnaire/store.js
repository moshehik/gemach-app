// lib/policyQuestionnaire/store.js - גישה למסד הנתונים של שאלון המדיניות (שרת בלבד).
//
// הטבלה PolicyQuestionnaireResponse נוצרת **ידנית בלבד**: prisma/migrations-pending/2026-10-06-policy-questionnaire-response.sql, שמורץ
// רק ע"י scripts/apply_policy_questionnaire_table.js (dry-run כברירת מחדל, --write באישור מפורש של הבעלים בזמן ההרצה, לכל גמ"ח בנפרד).
// **אין כאן שום DDL** (שום משפט שיוצר, משנה או מוחק טבלה/אינדקס) - כלל הבעלים: אין DDL מקוד האפליקציה בייצור. כשהטבלה עוד לא קיימת (42P01 / P2021 / P2010)
// הפונקציות כאן זורקות PolicyQuestionnaireDbError מסוג 'missing_table' בלי שום ניסיון חוזר ובלי ניסיון ליצור אותה, והמסלולים והדפים
// מציגים "השאלון עדיין לא הופעל" (ר' notEnabledPayload ב-logic.js). ר' docs/refund-questionnaire.md.
//
// SQL גולמי ($queryRawUnsafe) ולא prisma.<model>: תוסף ה-AuditLog של Prisma עוטף רק פעולות על מודלים, ולכן אין כאן רעש ביומן ההיסטוריה
// (המודל מוצהר ב-schema.prisma לתיעוד המסד, והוא גם ברשימת הדילוג של התוסף ב-app/lib/prisma.js).
//
// שורה אחת חיה לכל (שאלון, עובדת): UNIQUE (questionnaireKey, employeeId). שליחה חוזרת מעדכנת את אותה שורה.
// אין כאן קריאות בתוך $transaction (CLAUDE.md) - כל פעולה היא משפט בודד.
//
// עמידות: קריאה/כתיבה שנכשלת בגלל התעוררות של Neon (P1001/P2024/timeout) מנוסה פעם נוספת אחרי 1.5 שניות (ללא DDL). שגיאה סופית נזרקת
// כ-PolicyQuestionnaireDbError עם .kind ('missing_table' | 'transient' | 'other') ו-.userMessage בעברית.

import { randomUUID } from 'node:crypto';
import prisma from '@/app/lib/prisma';
import { classifyDbError, NOT_ENABLED_FORM_MESSAGE } from '@/lib/policyQuestionnaire/logic';

const TABLE = '"PolicyQuestionnaireResponse"';

export class PolicyQuestionnaireDbError extends Error {
  constructor(kind, cause) {
    super(`policy questionnaire DB error (${kind})`);
    this.name = 'PolicyQuestionnaireDbError';
    this.kind = kind;
    this.cause = cause;
    this.userMessage = kind === 'missing_table'
      ? NOT_ENABLED_FORM_MESSAGE
      : kind === 'transient'
        ? 'אין כרגע חיבור למסד הנתונים (ייתכן שהוא רק מתעורר). נסו שוב בעוד רגע - התשובות שכבר נשמרו לא אבדו.'
        : 'אירעה שגיאה בשמירה או בטעינה של השאלון. נסו שוב בעוד רגע, ואם זה חוזר - פנו למתכנת.';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * מריץ פעולת DB. תקלת חיבור (התעוררות Neon) מנוסה פעם נוספת אחרי 1.5 שניות. טבלה חסרה = עצירה מיידית (בלי ניסיון חוזר, בלי יצירה):
 * זורק PolicyQuestionnaireDbError('missing_table'). כל שגיאה סופית אחרת נזרקת כ-PolicyQuestionnaireDbError עם הסוג שלה.
 */
async function withDb(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const kind = classifyDbError(e);
      if (kind === 'missing_table') throw new PolicyQuestionnaireDbError('missing_table', e);
      console.warn(`policyQuestionnaire store: ${kind} (attempt ${attempt + 1}):`, e?.message || e);
      if (kind === 'transient') { await sleep(1500); continue; }
      break;
    }
  }
  throw new PolicyQuestionnaireDbError(classifyDbError(lastErr), lastErr);
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

function mapRow(r) {
  if (!r) return null;
  let answers = r.answers;
  if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch { answers = {}; } }
  return {
    id: r.id,
    questionnaireKey: r.questionnaireKey,
    orgKey: r.orgKey,
    employeeId: r.employeeId,
    respondentName: r.respondentName || '',
    respondentRole: r.respondentRole || '',
    answers: answers && typeof answers === 'object' ? answers : {},
    status: r.status,
    submittedAt: iso(r.submittedAt),
    emailedAt: iso(r.emailedAt),
    emailError: r.emailError || null,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

/** השורה של עובדת בשאלון, או null. */
export function getResponse(questionnaireKey, employeeId) {
  return withDb(async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM ${TABLE} WHERE "questionnaireKey" = $1 AND "employeeId" = $2 LIMIT 1`,
      questionnaireKey, employeeId
    );
    return mapRow(rows && rows[0]);
  });
}

/** כל השורות של שאלון בגמ"ח הזה (לדף הבעלים), החדשות ראשונות. */
export function listResponses(questionnaireKey, orgKey) {
  return withDb(async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM ${TABLE} WHERE "questionnaireKey" = $1 AND "orgKey" = $2 ORDER BY COALESCE("submittedAt", "updatedAt") DESC`,
      questionnaireKey, orgKey
    );
    return (rows || []).map(mapRow);
  });
}

/**
 * שמירה אוטומטית: יוצר שורה (טיוטה) או מעדכן תשובות ופרטי משיבה בשורה קיימת. סטטוס/תאריכי שליחה/מייל לא משתנים.
 * @param {{questionnaireKey:string, orgKey:string, employeeId:string, name:string, role:string, answers:object}} p
 */
export function saveDraft({ questionnaireKey, orgKey, employeeId, name, role, answers }) {
  return withDb(async () => {
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO ${TABLE} ("id", "questionnaireKey", "orgKey", "employeeId", "respondentName", "respondentRole", "answers", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8, $8)
       ON CONFLICT ("questionnaireKey", "employeeId") DO UPDATE
         SET "respondentName" = EXCLUDED."respondentName", "respondentRole" = EXCLUDED."respondentRole",
             "answers" = EXCLUDED."answers", "updatedAt" = $8
       RETURNING *`,
      randomUUID(), questionnaireKey, orgKey, employeeId, name || '', role || '', JSON.stringify(answers || {}), new Date()
    );
    return mapRow(rows && rows[0]);
  });
}

/**
 * שליחה סופית (גם שליחה חוזרת אחרי "עדכון התשובות"): status='submitted', submittedAt=updatedAt=אותו רגע.
 * emailedAt נשמר (כדי שהמייל הבא יסומן "עודכן"); emailError מתאפס.
 */
export function submitResponse({ questionnaireKey, orgKey, employeeId, name, role, answers }) {
  return withDb(async () => {
    const now = new Date();
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO ${TABLE} ("id", "questionnaireKey", "orgKey", "employeeId", "respondentName", "respondentRole", "answers", "status", "submittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'submitted', $8, $8, $8)
       ON CONFLICT ("questionnaireKey", "employeeId") DO UPDATE
         SET "respondentName" = EXCLUDED."respondentName", "respondentRole" = EXCLUDED."respondentRole",
             "answers" = EXCLUDED."answers", "status" = 'submitted', "submittedAt" = $8, "updatedAt" = $8, "emailError" = NULL
       RETURNING *`,
      randomUUID(), questionnaireKey, orgKey, employeeId, name || '', role || '', JSON.stringify(answers || {}), now
    );
    return mapRow(rows && rows[0]);
  });
}

/** רישום תוצאת שליחת המייל על השורה. updatedAt לא משתנה (אחרת "יש שינויים שלא נשלחו" היה נדלק בטעות). */
export function recordEmailResult(id, { sent, error }) {
  return withDb(async () => {
    const rows = await prisma.$queryRawUnsafe(
      sent
        ? `UPDATE ${TABLE} SET "emailError" = $2, "emailedAt" = $3 WHERE "id" = $1 RETURNING *`
        : `UPDATE ${TABLE} SET "emailError" = $2 WHERE "id" = $1 RETURNING *`,
      ...(sent
        ? [id, error ? String(error).slice(0, 500) : null, new Date()]
        : [id, error ? String(error).slice(0, 500) : null])
    );
    return mapRow(rows && rows[0]);
  });
}
