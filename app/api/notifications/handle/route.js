import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';
import { getCachedSetting } from '@/lib/settingsCache';

// #25 — סימון הודעת "להנהלה" כ"טופל" / ביטול טיפול. מוגבל לבעלי תפקיד מנהל
// (checkAuth('מנהל') — roleId 1/2, ר' lib/auth.js ROLE_LEVELS) ומותנה בהגדרת
// המערכת management_messages.
export async function POST(request) {
  try {
    const setting = await getCachedSetting('management_messages');
    if (!(setting && setting.value === 'true')) {
      return NextResponse.json({ success: false, error: 'התכונה כבויה בהגדרות המערכת' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const employeeId = token.value;

    if (!(await checkAuth('מנהל'))) {
      return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת להנהלה בלבד' }, { status: 403 });
    }

    const body = await request.json();
    const { notificationId, handled } = body;
    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }
    if (notification.category !== 'management') {
      return NextResponse.json({ success: false, error: 'לא ניתן לסמן הודעה זו כטופל' }, { status: 400 });
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
