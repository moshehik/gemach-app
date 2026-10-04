import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { canViewOthersActivity, isViewableEmployee, employeeChipName } from '@/lib/recentActivityAccess';

export const dynamic = 'force-dynamic';

// GET /api/me/recent-activity/employees - רשימת העובדות לבורר ("שבבים") של "השינויים שלי" (MY-04 ב).
//   -> { employees: [{ id, name }], meId }  (meId = העובדת המחוברת, כדי שהבורר לא יציג אותה פעמיים)  שמות ומזהים בלבד (בלי שכר, קוד, סיסמה, טלפון, תפקיד). עובדות פעילות בלבד, ללא עובדי שירות, עד 60.
// הרשאה: page:orders + feature:view_others_recent_activity (ברירת מחדל הנהלה ראשית / מתכנת), נבדק מהעוגייה החתומה בשרת.
// בלי הרשאה / בלי זהות = 403 (הלקוח לא מציג בורר). קריאה בלבד.

const json = (body, status = 200) => NextResponse.json(body, { status });
const MAX_EMPLOYEES = 60;

export async function GET() {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);
  const me = await getActingEmployeeId();
  if (!me || !(await canViewOthersActivity(me))) return json({ error: 'Forbidden' }, 403);
  try {
    const rows = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, fullName: true, isActive: true, legacyId: true },
      orderBy: [{ lastName: { sort: 'asc', nulls: 'last' } }, { firstName: { sort: 'asc', nulls: 'last' } }],
      take: MAX_EMPLOYEES + 40, // מרווח לעובדי שירות שיסוננו
    });
    const employees = rows.filter(isViewableEmployee).map((e) => ({ id: e.id, name: employeeChipName(e) })).filter((e) => e.name).slice(0, MAX_EMPLOYEES);
    return json({ employees, meId: me });
  } catch (error) {
    console.error('recent-activity employees error:', error);
    return json({ employees: [], meId: me, degraded: true });
  }
}
