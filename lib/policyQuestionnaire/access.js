// lib/policyQuestionnaire/access.js - הרשאות והקשר של שאלון המדיניות (שרת בלבד).
//
// מענה ותוצאות: הנהלה ראשית (roleId 0) ומתכנת (roleId 2) בלבד = HEAD_MANAGEMENT_ROLES, אותו שער כמו /admin.
// הזהות מגיעה תמיד מהעוגייה המאומתת בשרת (getSessionEmployee) - אף פעם לא ממזהה שנשלח מהדפדפן.
// checkAuth('הנהלה ראשית') נכשל סגור (שגיאת DB = אין גישה) ודורש עובד מחובר גם כשחובת ההתחברות כבויה.

import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { currentOrg } from '@/lib/orgIdentity';
import { getQuestionnaire, QUESTIONNAIRE_KEY } from '@/lib/policyQuestionnaire/questions-refunds-2026-10';
import { publicQuestionnaire, groupSubmissions } from '@/lib/policyQuestionnaire/logic';
import { listSubmissions } from '@/lib/policyQuestionnaire/store';

export { QUESTIONNAIRE_KEY };

const ROLE_LABELS = { 0: 'הנהלה ראשית', 2: 'מתכנת' };

/** השאלון של הגמ"ח שמריץ את הקוד כרגע (לפי currentOrg). */
export function currentQuestionnaire() {
  return getQuestionnaire(currentOrg());
}

function displayName(emp) {
  const full = (emp.fullName || '').trim();
  if (full) return full;
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
}

/**
 * מחזיר את העובדת המחוברת אם היא בהנהלה ראשית/מתכנת, אחרת סיבה.
 * page=true: לקריאה מתוך דף שרת (Server Component): בלי checkAuth, כי הוא עלול לחדש את עוגיית ההתחברות ועוגיות אי אפשר
 * לכתוב מדף שרת. getSessionEmployee כבר מאמת את העוגייה החתומה וקורא את התפקיד מה-DB (נכשל סגור), כך שהשער זהה בפועל.
 * @returns {Promise<{ok:true, employee:{id:string, roleId:number, name:string, roleLabel:string}} | {ok:false, status:401|403, error:string}>}
 */
export async function requireHeadManagement({ page = false } = {}) {
  const allowed = page ? true : await checkAuth('הנהלה ראשית');
  const me = await getSessionEmployee();
  if (!me) return { ok: false, status: 401, error: 'צריך להתחבר לאתר כדי למלא את השאלון.' };
  if (!allowed || !HEAD_MANAGEMENT_ROLES.includes(me.roleId)) {
    return { ok: false, status: 403, error: 'השאלון מיועד להנהלה בלבד.' };
  }
  let name = '';
  try {
    const emp = await prisma.employee.findUnique({ where: { id: me.id }, select: { firstName: true, lastName: true, fullName: true } });
    if (emp) name = displayName(emp);
  } catch (e) {
    console.warn('policyQuestionnaire: could not load employee name:', e?.message || e);
  }
  return { ok: true, employee: { id: me.id, roleId: me.roleId, name, roleLabel: ROLE_LABELS[me.roleId] || '' } };
}

/**
 * נתוני דף התוצאות (להנהלה ראשית ולמתכנת): השאלון + כל התשובות של הגמ"ח הזה, מקובצות לפי משיבה (השליחה האחרונה במלואה, וגרסאות קודמות כטקסט).
 * התשובות נקראות מתגובות השרשור (ר' store.js). source (מקור פנימי) רק למתכנת (roleId 2) = הבעלים.
 * נקרא גם מ-GET /api/policy-questionnaire/answers וגם מדף השרת app/refund-questionnaire/answers/page.js.
 */
export async function loadResultsPayload(employee) {
  const qn = currentQuestionnaire();
  const { threadId, replies } = await listSubmissions(QUESTIONNAIRE_KEY);
  const respondents = groupSubmissions(qn, replies).map((g) => ({
    key: g.key,
    name: g.name,
    role: g.role,
    count: g.count,
    latest: g.latest,
    earlier: g.earlier.map((e) => ({ id: e.id, createdAt: e.createdAt, text: e.text, updated: e.updated })),
  }));
  return {
    questionnaire: publicQuestionnaire(qn, { includeSource: employee.roleId === 2 }),
    threadFound: !!threadId,
    respondents,
  };
}
