import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { checkAuth } from '../../../../../lib/auth';

// 2026-10-12: was public. Its only consumer is /admin/database (developer-only layout), which calls it with the session cookie.
export async function GET() {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const statusFilePath = path.join(process.cwd(), 'migration_status.json');
    
    if (!fs.existsSync(statusFilePath)) {
      return NextResponse.json({ status: 'idle', progress: 0, message: 'ממתין' });
    }

    const data = await readFile(statusFilePath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading status file:', error);
    return NextResponse.json({ error: 'Failed to read status.' }, { status: 500 });
  }
}
