import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { parseIdList, parseNotificationActionBody } from '../../../../lib/notificationLists';
import { markAllNotificationsRead } from '../../../../lib/notificationsBulk';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// POST /api/notifications/read
//   { notificationId }  — הודעה אחת (ההתנהגות המקורית, ללא שינוי)
//   { all: true }       — "סמן הכל כנקרא" (פעמון התפריט החדש): כל ההודעות של העובד המחובר בלבד —
//                         האישיות שלו + הכלליות שבחלון התצוגה (lib/notificationsBulk.js). אין פרמטר של עובד אחר.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = parseNotificationActionBody(body);
    if (parsed.error) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    if (parsed.mode === 'all') {
      const result = await markAllNotificationsRead(prisma, employeeId);
      return NextResponse.json({ success: true, all: true, updated: { personal: result.personal, global: result.global }, conflicts: result.conflicts });
    }

    const { notificationId } = parsed;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (notification.receiverId === employeeId) {
      // Personal message
      await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true }
      });
    } else if (notification.receiverId === null) {
      // Global message: readBy is a scalar String column holding a JSON-encoded
      // array of employeeIds as text, not a native Prisma list field.
      const readByArr = parseIdList(notification.readBy);
      if (!readByArr.includes(employeeId)) {
        readByArr.push(employeeId);
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            readBy: JSON.stringify(readByArr)
          }
        });
      }
    } else {
      return NextResponse.json({ success: false, error: 'Unauthorized to read this notification' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
