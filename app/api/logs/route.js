import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    console.log('[UI_LOG]', body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging UI event:', error);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}
