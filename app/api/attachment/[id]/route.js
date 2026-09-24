import prisma from '../../../lib/prisma';

// הגשת קבצים בינאריים שנשמרו ב-DB (טבלת Attachment, ר' lib/dressImageStorage.js) -
// תמונות דגמי שמלה, צילומי/הקלטות מסך בדיווחי שגיאה, והקלטות מסך בעוזר ה-AI.
// גישה ציבורית בכוונה (כמו שהיה מול Vercel Blob עם access:'public') - ה-id
// עצמו (UUID) הוא ה"סוד", בדיוק כמו כתובת Blob שאי אפשר לנחש.
export async function GET(request, { params }) {
  const { id } = await params;
  // ?n=<שם קובץ> - צרופות מהמחשב לדיווחי תקלה (lib/attachmentUpload.js). וורד/אקסל וכד' יורדים
  // כקובץ עם השם הנכון במקום להיפתח בדפדפן.
  const rawName = new URL(request.url).searchParams.get('n');
  const fileName = rawName ? rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) : null;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!attachment) {
    return new Response(null, { status: 404 });
  }
  const inlineOk = /^(image|video|audio)\//.test(attachment.contentType) || attachment.contentType === 'application/pdf' || attachment.contentType.startsWith('text/plain');
  return new Response(attachment.data, {
    headers: {
      'Content-Type': attachment.contentType,
      ...(fileName ? { 'Content-Disposition': `${inlineOk ? 'inline' : 'attachment'}; filename="${fileName}"`, 'X-Content-Type-Options': 'nosniff' } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
