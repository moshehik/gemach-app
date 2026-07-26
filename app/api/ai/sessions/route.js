import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const skip = (page - 1) * limit;

    const sessions = await prisma.aIChatSession.findMany({
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      skip,
      take: limit
    });

    const total = await prisma.aIChatSession.count();

    return NextResponse.json({
      success: true,
      data: sessions,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching AI sessions', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const { sessionId, context, messages } = await request.json();

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    const employeeId = token ? token.value : null;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const messagesJson = JSON.stringify(messages);
    let session;

    if (sessionId) {
      session = await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: {
          messagesJson,
          context: context || undefined,
        }
      });
    } else {
      session = await prisma.aIChatSession.create({
        data: {
          employeeId,
          context: context || 'כללי',
          messagesJson
        }
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (err) {
    console.error('Error saving AI session', err);
    return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
  }
}
