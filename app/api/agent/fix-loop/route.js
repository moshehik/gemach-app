// מצב "סוכן תיקון אוטומטי" - דגל SystemSetting שהאייקון ב-ErrorReportButton.js קובע.
// ה-workflow ב-.github/workflows/claude-fix-reports.yml רץ מ-cron כל 5 דק' ותמיד, אבל
// שלב 0 שלו (scripts/agent-loop-status.js) בודק את הדגל הזה ישירות ב-DB ויוצא מיד אם כבוי -
// זה מה שהופך את ה-cron התמידי לפעולה נשלטת מהאייקון בפועל. הדגל נשאר דלוק ללא הגבלת
// זמן ברגע שהודלק (אין יותר כיבוי-אוטומטי-משקט, בוטל 2026-09-14) - הכיבוי היחיד הוא
// הוראת-עצירה מפורשת בתוך דיווח, או כאן דרך PATCH עם enabled:false. הפעלה מכאן גם
// כותבת ל-agent_fix_loop_last_activity - תיעוד "מתי הודלק לאחרונה" בלבד כרגע, לא
// נבדק ע"י שום שלב עוד.
//
// דגל שני, עצמאי (2026-09-23): agent_fix_loop_deploy_enabled - קובע האם מותר לסוכן
// לפתוח ענף+PR (ומכאן Vercel Preview Deployment אוטומטי לכל push, ר' fix-reports.md).
// כשהוא כבוי הסוכן ממשיך לרוץ, לקרוא דיווחים ולהשיב בשרשורים כרגיל (אפשר "לשוחח" איתו)
// אבל לא נוגע ב-git בכלל - זה נועד למקרה שהמכסה היומית של 100 פריסות ב-Vercel מתמלאת
// מהר מדי מה-PR-ים שהוא פותח. ברירת המחדל (שורה לא קיימת עדיין ב-DB) היא true כדי
// לשמר את ההתנהגות הקודמת לכל מי שלא נגע בזה.
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { cookies } from 'next/headers';
import { getCachedSetting, invalidateSettingsCache } from '@/lib/settingsCache';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

const SETTING_KEY = 'agent_fix_loop_enabled';
const DEPLOY_KEY = 'agent_fix_loop_deploy_enabled';
const ACTIVITY_KEY = 'agent_fix_loop_last_activity';

export async function GET() {
  try {
    const [row, deployRow] = await Promise.all([
      getCachedSetting(SETTING_KEY),
      getCachedSetting(DEPLOY_KEY),
    ]);
    return NextResponse.json({
      success: true,
      enabled: row?.value === 'true',
      deployEnabled: deployRow?.value !== 'false',
    });
  } catch (error) {
    console.error('Error reading agent loop status:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בקריאת מצב הסוכן' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'לא מורשה' }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (!employee || employee.roleId !== 2) {
      return NextResponse.json({ success: false, error: 'הפעלת הסוכן מותרת למתכנת בלבד' }, { status: 403 });
    }

    const { enabled, deployEnabled } = await request.json().catch(() => ({}));
    if (typeof enabled !== 'boolean' && typeof deployEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'נתונים לא תקינים' }, { status: 400 });
    }

    if (typeof enabled === 'boolean') {
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
    }

    if (typeof deployEnabled === 'boolean') {
      await prisma.systemSetting.upsert({
        where: { key: DEPLOY_KEY },
        update: { value: String(deployEnabled) },
        create: {
          key: DEPLOY_KEY,
          value: String(deployEnabled),
          name: 'הסוכן האוטומטי מותר לו לפרוס (לפתוח ענף+PR) בוורסל',
          category: 'מערכת',
          type: 'boolean',
        },
      });
      invalidateSettingsCache(DEPLOY_KEY);
    }

    return NextResponse.json({
      success: true,
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(typeof deployEnabled === 'boolean' ? { deployEnabled } : {}),
    });
  } catch (error) {
    console.error('Error toggling agent loop:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בעדכון מצב הסוכן' }, { status: 500 });
  }
}
