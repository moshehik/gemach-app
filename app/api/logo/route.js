import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import prisma from '@/app/lib/prisma';

export async function GET() {
  try {
    const setting = await getCachedSetting('BRAND_LOGO');

    if (!setting || !setting.value) {
      // Return a 404 or a transparent 1x1 pixel image
      return new NextResponse('Not found', { status: 404 });
    }

    // The value is a base64 string (e.g., "data:image/png;base64,iVBORw0KGgo...")
    const base64Data = setting.value.split(',')[1] || setting.value;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Extract mime type if present, otherwise default to png
    const mimeMatch = setting.value.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}