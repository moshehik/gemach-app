import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Convert to Base64
    const mimeType = file.type || 'image/png';
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;
    
    // Save to database instead of static public folder to avoid Next.js caching issues
    await prisma.systemSetting.upsert({
      where: { key: 'BRAND_LOGO' },
      update: { value: base64Data },
      create: { key: 'BRAND_LOGO', value: base64Data, name: 'לוגו מערכת' }
    });

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הלוגו' }, { status: 500 });
  }
}
