import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Available only in development mode' }, { status: 403 });
  }

  try {
    const { mode } = await request.json(); // 'prod' or 'test'
    if (mode !== 'prod' && mode !== 'test') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Save choice to file for persistence across restarts
    const dbFile = path.join(process.cwd(), '.active-db');
    fs.writeFileSync(dbFile, mode);

    // Update global for immediate effect in this process
    globalThis.activeDbMode = mode;

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    console.error("Error switching env:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Available only in development mode' }, { status: 403 });
  }

  const mode = globalThis.activeDbMode || 'prod';
  return NextResponse.json({ 
    mode,
    urls: {
      prod: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL,
      test: process.env.TEST_DATABASE_URL || ''
    }
  });
}
