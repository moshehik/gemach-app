import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { parseIdList, parseNotificationActionBody, parseArchiveFlag } from '../../../../lib/notificationLists';
import { archiveAllNotifications } from '../../../../lib/notificationsBulk';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// POST /api/notifications/archive
//   { notificationId, archive }   — הודעה אחת (ההתנהגות המקורית, ללא שינוי; archive=true לארכיון, false להחזרה)
//   { all: true, archive: true }  — "ניקוי" (פעמון התפריט החדש): כל ההודעות של העובד המחובר בלבד עוברות לארכיון
//                                   (לא נמחקות — נשארות בלשונית "ארכיון" ב-/messages). archive חסר = true;
//                                   { all: true, archive: false } מחזיר את כולן מהארכיון. archive שאינו בוליאני
//                                   (למשל "false" כמחרוזת) → 400, כדי שלא יארכב בטעות.
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
      const flag = parseArchiveFlag(body.archive);
      if (flag.error) {
        return NextResponse.json({ success: false, error: flag.error }, { status: 400 });
      }
      const doArchive = flag.archive;
      const result = await archiveAllNotifications(prisma, employeeId, doArchive);
      return NextResponse.json({ success: true, all: true, archived: doArchive, updated: { personal: result.personal, global: result.global }, conflicts: result.conflicts });
    }

    const { notificationId } = parsed;
    const { archive } = body; // archive is a boolean (true to archive, false to unarchive)

    // Find the notification to check if it's global or personal
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (notification.receiverId === null) {
      // Global notification: archivedBy is a scalar String column holding a
      // JSON-encoded array of employeeIds as text, not a native Prisma list field.
      let updatedArchivedBy = parseIdList(notification.archivedBy);
      if (archive && !updatedArchivedBy.includes(employeeId)) {
        updatedArchivedBy.push(employeeId);
      } else if (!archive && updatedArchivedBy.includes(employeeId)) {
        updatedArchivedBy = updatedArchivedBy.filter(id => id !== employeeId);
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          archivedBy: JSON.stringify(updatedArchivedBy)
        }
      });
    } else {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isArchived: archive }
      });
    }

    return NextResponse.json({ success: true, archived: archive });
  } catch (error) {
    console.error('Error toggling archive:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
