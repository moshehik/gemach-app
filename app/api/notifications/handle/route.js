import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { getCachedSetting } from '@/lib/settingsCache';

// #24/#25 — סימון הודעת "להנהלה" או "בין משמרות" כ"טופל" / ביטול טיפול.
// management: מוגבל ל-roleId 0/1/2 (הנהלה ראשית/מנהל/מתכנת) ומותנה בהגדרת
// המערכת management_messages. נבדק ישירות מול roleId (כמו ב-error-report/route.js)
// ולא דרך checkAuth('מנהל') המשותף (ROLE_LEVELS['מנהל']=[1,2] בלבד ב-lib/auth.js)
// כי roleId 0 (הנהלה ראשית) חייב לעבור כאן, אבל ROLE_LEVELS['מנהל'] משמש עוד
// כ-75 מקומות באפליקציה שאין לגעת בהם דרך השינוי הזה.
// shift_handover: כל עובד מחובר יכול לסמן/לבטל (אין הגבלת תפקיד — עדכון בין
// משמרות הוא באחריות משותפת), מותנה בהגדרת המערכת shift_handover_notes.
const MANAGEMENT_ROLE_IDS = [0, 1, 2];
const SETTING_KEY_BY_CATEGORY = {
  management: 'management_messages',
  shift_handover: 'shift_handover_notes',
};

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const employeeId = token.value;

    const body = await request.json();
    const { notificationId, handled } = body;
    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }
    const settingKey = SETTING_KEY_BY_CATEGORY[notification.category];
    if (!settingKey) {
      return NextResponse.json({ success: false, error: 'לא ניתן לסמן הודעה זו כטופל' }, { status: 400 });
    }

    const setting = await getCachedSetting(settingKey);
    if (!(setting && setting.value === 'true')) {
      return NextResponse.json({ success: false, error: 'התכונה כבויה בהגדרות המערכת' }, { status: 403 });
    }

    if (notification.category === 'management') {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { roleId: true } });
      if (!employee || !MANAGEMENT_ROLE_IDS.includes(employee.roleId)) {
        return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת להנהלה בלבד' }, { status: 403 });
      }
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: handled
        ? { handledAt: new Date(), handledById: employeeId }
        : { handledAt: null, handledById: null },
      include: { handledBy: { select: { firstName: true, lastName: true } } }
    });

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error('Error toggling notification handled state:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
