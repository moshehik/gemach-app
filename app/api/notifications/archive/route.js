import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { parseIdList } from '../../../../lib/notificationLists';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, archive } = body; // archive is a boolean (true to archive, false to unarchive)

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

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
