import prisma from '../../../lib/prisma';
import { ATTACHMENT_FILE_TYPES } from '@/lib/attachmentFileTypes';

// הגשת קבצים בינאריים שנשמרו ב-DB (טבלת Attachment, ר' lib/dressImageStorage.js) -
// תמונות דגמי שמלה, צילומי/הקלטות מסך בדיווחי שגיאה, והקלטות מסך בעוזר ה-AI.
// גישה ציבורית בכוונה (כמו שהיה מול Vercel Blob עם access:'public') - ה-id
// עצמו (UUID) הוא ה"סוד", בדיוק כמו כתובת Blob שאי אפשר לנחש.
export async function GET(request, { params }) {
  const { id } = await params;
  // ids are uuids; anything else (null bytes, path fragments, SQL-looking text) is a 404 instead of a DB error
  if (typeof id !== 'string' || !/^[0-9a-fA-F-]{8,64}$/.test(id)) return new Response(null, { status: 404 });
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
  // This route is public AND same-origin with the app, so a stored text/html (or svg / xml / js) body would run as a page of the app
  // (stored XSS: POST /api/upload used to keep the client-sent type for files sharp cannot decode). Active types are never served
  // as themselves - they go out as a download (octet-stream + attachment) - and nosniff is always on. SVG images are re-encoded to
  // JPEG at upload, so only legacy rows can still carry image/svg+xml; it is treated as active here too.
  // Allowlist: media (minus svg), pdf, plain text, and the office/document types error reports may attach (lib/attachmentFileTypes.js).
  const active = !((inlineOk && !/^image\/svg/i.test(attachment.contentType)) || Object.values(ATTACHMENT_FILE_TYPES).includes(attachment.contentType));
  return new Response(attachment.data, {
    headers: {
      'Content-Type': active ? 'application/octet-stream' : attachment.contentType,
      'X-Content-Type-Options': 'nosniff',
      ...(active ? { 'Content-Disposition': 'attachment; filename="download"' } : {}),
      ...(fileName ? { 'Content-Disposition': `${inlineOk && !active ? 'inline' : 'attachment'}; filename="${fileName}"` } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
