import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { issueSessionCookie } from '@/lib/auth';

// כניסה ייעודית לסוכן ה-AI לבדיקה חיה (Moshe, 2026-09-23) - כדי שיוכל לפתוח מסכים מוגני-הרשאה
// ולאמת תיקונים בפועל בלי להזין סיסמה בשום שדה בשום מסך (אף אחד, אף פעם - זה כלל קבוע של
// הסוכן, לא רק פה). מכוון וגלוי, לא פרצה: חסום כליל (404, לא 403 - לא מגלה שהמסלול קיים)
// אלא אם AGENT_LOGIN_SECRET מוגדר בסביבה הזו וה-secret שהתקבל תואם לו במדויק. ריק = כבוי,
// בין אם ב-production ובין אם ב-preview - זה תלוי החלטה מפורשת של הבעלים דרך Vercel env
// (לא תלוי קוד), לכל סביבה בנפרד.
export async function GET(request) {
  const configuredSecret = process.env.AGENT_LOGIN_SECRET;
  if (!configuredSecret) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get('secret');
  if (!providedSecret || providedSecret !== configuredSecret) {
    return new NextResponse('Not found', { status: 404 });
  }

  // legacyId שמור (מעל הטווח האמיתי בשני הגמחים) - קבוע ומזוהה בבירור, לא נוצר עובד כפול
  // בכל קריאה. שם ברור בכוונה כדי שאף פעם לא יתבלבל עם עובד אמיתי בהיסטוריית שינויים/דיווחים.
  const AGENT_LEGACY_ID = 999999;
  let employee = await prisma.employee.findUnique({ where: { legacyId: AGENT_LEGACY_ID } });
  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        legacyId: AGENT_LEGACY_ID,
        firstName: 'סוכן AI',
        lastName: '(בדיקה אוטומטית - לא עובדת אמיתית)',
        roleId: 2,
        isActive: true,
        notes: 'נוצר אוטומטית ע"י app/api/dev/agent-login - כניסה ללא סיסמה לצורך אימות תיקונים ע"י הסוכן. אין למחוק אלא אם מבטלים את המנגנון כליל (גם מ-AGENT_LOGIN_SECRET).',
      },
    });
  } else if (!employee.isActive) {
    // אם מנוהל/מנהלת כיבה את החשבון בעבר - מחזירים אותו לפעיל, זה כל הייעוד שלו.
    employee = await prisma.employee.update({ where: { id: employee.id }, data: { isActive: true } });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: 'auth_token',
    value: employee.id,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  try {
    issueSessionCookie(cookieStore, employee);
  } catch (e) {
    console.warn('agent-login: issueSessionCookie failed:', e?.message || e);
  }

  console.log(`[agent-login] AI agent logged in as employee ${employee.id} (legacyId ${AGENT_LEGACY_ID}) at ${new Date().toISOString()}`);

  return NextResponse.redirect(new URL('/', request.url));
}
