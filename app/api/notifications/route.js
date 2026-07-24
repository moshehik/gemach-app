import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request) {
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

    // Fetch personal messages or global messages
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { receiverId: employeeId },
          { receiverId: null }
        ]
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to 100 recent notifications
    });

    // Map to add an isRead and isArchived computed property for global messages
    const mapped = notifications.map(notif => {
      let isArchived = notif.isArchived;
      if (notif.receiverId === null) {
        isArchived = (notif.archivedBy || []).includes(employeeId);
      }
      return {
        ...notif,
        isRead: notif.receiverId === null ? (notif.readBy || []).includes(employeeId) : notif.isRead,
        isArchived,
        personalTags: notif.tags.map(t => t.tag)
      };
    });

    const outgoing = await prisma.notification.findMany({
      where: { senderId: employeeId },
      include: {
        receiver: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const mappedOutgoing = outgoing.map(notif => ({
      ...notif,
      personalTags: notif.tags.map(t => t.tag)
    }));

    return NextResponse.json({ success: true, notifications: mapped, outgoing: mappedOutgoing });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message, stack: error.stack }, { status: 500 });
  }
}

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
    const { receiverId, title, content } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Validate if receiverId is provided, else it's a global message
    const parsedReceiver = receiverId === 'all' || receiverId === null ? null : receiverId;

    const notification = await prisma.notification.create({
      data: {
        senderId: employeeId,
        receiverId: parsedReceiver,
        title: title || 'הודעה חדשה',
        content,
      }
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
