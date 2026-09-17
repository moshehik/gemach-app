import prisma from '../../../lib/prisma';

// הגשת קבצים בינאריים שנשמרו ב-DB (טבלת Attachment, ר' lib/dressImageStorage.js) -
// תמונות דגמי שמלה, צילומי/הקלטות מסך בדיווחי שגיאה, והקלטות מסך בעוזר ה-AI.
// גישה ציבורית בכוונה (כמו שהיה מול Vercel Blob עם access:'public') - ה-id
// עצמו (UUID) הוא ה"סוד", בדיוק כמו כתובת Blob שאי אפשר לנחש.
export async function GET(request, { params }) {
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!attachment) {
    return new Response(null, { status: 404 });
  }
  return new Response(attachment.data, {
    headers: {
      'Content-Type': attachment.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
