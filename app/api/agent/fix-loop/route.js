// מצב "סוכן תיקון אוטומטי" - דגל SystemSetting שהאייקון ב-ErrorReportButton.js קובע.
// ה-workflow ב-.github/workflows/claude-fix-reports.yml רץ מ-cron כל 5 דק' ותמיד, אבל
// שלב 0 שלו (scripts/agent-loop-status.js) בודק את הדגל הזה ישירות ב-DB ויוצא מיד אם כבוי -
// זה מה שהופך את ה-cron התמידי לפעולה נשלטת מהאייקון בפועל. הפעלה מכאן גם מאפסת את
// agent_fix_loop_last_activity ("שעון השקט") - כך שהסוכן לא ייכנס מיד למצב שינה
// (20 דק' בלי פעילות, ר' scripts/agent-loop-status.js --idle-minutes) מיד אחרי שהודלק.
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { getCachedSetting, invalidateSettingsCache } from '@/lib/settingsCache';

const SETTING_KEY = 'agent_fix_loop_enabled';
const ACTIVITY_KEY = 'agent_fix_loop_last_activity';

export async function GET() {
  try {
    const row = await getCachedSetting(SETTING_KEY);
    return NextResponse.json({ success: true, enabled: row?.value === 'true' });
  } catch (error) {
    console.error('Error reading agent loop status:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בקריאת מצב הסוכן' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'לא מורשה' }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (!employee || employee.roleId !== 2) {
      return NextResponse.json({ success: false, error: 'הפעלת הסוכן מותרת למתכנת בלבד' }, { status: 403 });
    }

    const { enabled } = await request.json().catch(() => ({}));
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'נתונים לא תקינים' }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: String(enabled) },
      create: {
        key: SETTING_KEY,
        value: String(enabled),
        name: 'סוכן תיקון דיווחים אוטומטי (GitHub Actions)',
        category: 'מערכת',
        type: 'boolean',
      },
    });
    invalidateSettingsCache(SETTING_KEY);

    if (enabled) {
      await prisma.systemSetting.upsert({
        where: { key: ACTIVITY_KEY },
        update: { value: new Date().toISOString() },
        create: {
          key: ACTIVITY_KEY,
          value: new Date().toISOString(),
          name: 'זמן פעילות אחרונה של הסוכן האוטומטי',
          category: 'מערכת',
          type: 'text',
        },
      });
    }

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('Error toggling agent loop:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בעדכון מצב הסוכן' }, { status: 500 });
  }
}
