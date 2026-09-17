import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { checkAuth } from '../../../../lib/auth';

// טוקן העלאה ישירה מהדפדפן ל-Vercel Blob - עוקף את מגבלת גודל הגוף של פונקציית
// ה-Serverless (ר' app/api/upload/route.js הרגיל, המתאים לתמונות קטנות בלבד).
// נדרש להקלטות מסך (useScreenRecorder.js), שיכולות להגיע לכמה MB.
export async function POST(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/webm'],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Client-token blob upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
