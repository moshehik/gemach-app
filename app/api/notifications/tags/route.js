import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';

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
    const { notificationId, tags } = body;

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json({ success: false, error: 'tags must be an array' }, { status: 400 });
    }

    // Delete existing tags for this user and notification
    await prisma.notificationTag.deleteMany({
      where: {
        notificationId,
        employeeId
      }
    });

    // Create new tags
    if (tags.length > 0) {
      const uniqueTags = [...new Set(tags)]; // Remove duplicates just in case
      await prisma.notificationTag.createMany({
        data: uniqueTags.map(tag => ({
          notificationId,
          employeeId,
          tag: tag.trim()
        }))
      });
    }

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('Error updating tags:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
