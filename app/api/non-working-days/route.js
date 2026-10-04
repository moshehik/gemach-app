import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { NON_WORKING_DAYS_SETTING_KEY, NON_WORKING_DAYS_PERMISSION_KEY } from '@/lib/businessDays';
import { canEditFrom } from '@/lib/nonWorkingDaysPage';
import { SETTINGS_HEBREW_NAMES } from '@/lib/settingsMetadata';

// GET /api/non-working-days - מצב הדף "ימי אי-פעילות" (/non-working-days). קריאה בלבד.
// מחזיר את הערך השמור של non_working_days_extra (מחרוזת כמו שהיא - הדף מפרסר עם lib/businessDays.js), את "היום"
// הישראלי, ו-canEdit: הנהלה ראשית / מתכנת או feature:non_working_days_manage (NWD-Q08, פירוש 9). אחרים: צפייה בלבד.
// השמירה עצמה עוברת ב-POST /api/settings (מנה שכולה המפתח הזה - שם נאכפת אותה הרשאה והערך מאומת).
// הערך נקרא ישירות מה-DB (לא מהמטמון של 30 שנ'), כי הדף משווה אליו לפני שמירה כדי לא לדרוס שינוי של מישהו אחר.
// כל גמ"ח קורא את ה-SystemSetting שלו (DB נפרד לכל ארגון) - אין כאן שום ערך משותף.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: NON_WORKING_DAYS_SETTING_KEY }, select: { value: true } });
    const employee = await getSessionEmployee();
    const hasManagePermission = employee ? await hasPermission(employee, NON_WORKING_DAYS_PERMISSION_KEY) : false;
    return NextResponse.json({
      key: NON_WORKING_DAYS_SETTING_KEY,
      name: SETTINGS_HEBREW_NAMES[NON_WORKING_DAYS_SETTING_KEY] || NON_WORKING_DAYS_SETTING_KEY,
      value: row && typeof row.value === 'string' ? row.value : '',
      today: getIsraelTodayKey(),
      userId: employee && employee.id !== undefined ? employee.id : null, // מפתח הטיוטה המקומית של הדף (לפי עובד)
      canEdit: canEditFrom({ logged: !!employee, hasManagePermission }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/non-working-days error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת ימי אי-הפעילות' }, { status: 500 });
  }
}
