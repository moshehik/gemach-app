import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save uploaded file temporarily
    const uploadDir = path.join(process.cwd(), '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const tempFilePath = path.join(uploadDir, 'AAA_uploaded.accdb');
    await writeFile(tempFilePath, buffer);

    // Initialize status file
    const statusFilePath = path.join(process.cwd(), 'migration_status.json');
    const initialStatus = {
      status: 'starting',
      progress: 5,
      message: 'מתחיל תהליך גיבוי...'
    };
    await writeFile(statusFilePath, JSON.stringify(initialStatus));

    // Skip on Vercel - MS Access migration requires Windows
    if (process.env.VERCEL) {
      return NextResponse.json({ success: false, message: 'Cannot run Access DB migration on Vercel (requires Windows)' }, { status: 400 });
    }

    // Spawn background process - bypass Turbopack static analysis
    const p = 'scripts/run_full_migration.js';
    const scriptPath = process.cwd() + '/' + p;
    
    // We use spawn and detach it so it runs in the background
    const childProcess = eval("require('child_process')");
    const child = childProcess.spawn('node', [scriptPath, tempFilePath], {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref(); // Allow the parent process to exit independently

    return NextResponse.json({ success: true, message: 'התהליך התחיל' });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to process file.' }, { status: 500 });
  }
}
