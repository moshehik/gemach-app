import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';

export async function GET() {
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
