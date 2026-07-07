import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Save to public/logo.png
    const uploadDir = path.join(process.cwd(), 'public');
    const filePath = path.join(uploadDir, 'logo.png');
    
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הלוגו' }, { status: 500 });
  }
}
