// lib/emailCenterAuth.js - שער ההרשאות של מרכז המיילים (כל ה-API תחת /api/admin/email-center).
//  * עריכת תבניות / שדות קבועים / תצוגה מקדימה: הנהלה ראשית או מתכנת (כמו checkAuth('הנהלה ראשית') בשאר מסכי הניהול והגדרות).
//  * שליחת דיוורים: *חובה עובד מחובר בפועל* (עוגייה מאומתת) בתפקיד הנהלה ראשית/מתכנת - גם כשחובת ההתחברות כבויה באתר.
//    כך שליחה המונית ללקוחות לעולם לא יוצאת ממצב "אורח אנונימי", והשורות ב-EmailLog מיוחסות לעובד.
import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';

export async function gateEmailAdmin({ needSession = false } = {}) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return { error: NextResponse.json({ error: 'אין הרשאה' }, { status: 401 }) };
  }
  const employee = await getSessionEmployee();
  if (needSession && !(employee && HEAD_MANAGEMENT_ROLES.includes(employee.roleId))) {
    return { error: NextResponse.json({ error: 'שליחת דיוורים דורשת התחברות כהנהלה ראשית / מתכנת' }, { status: 403 }) };
  }
  return { employee };
}

/** origin של הבקשה (לקישורי הסרה/תמונה מוחלטים). */
export function requestOrigin(request) {
  try { return request.nextUrl?.origin || new URL(request.url).origin; } catch { return ''; }
}
