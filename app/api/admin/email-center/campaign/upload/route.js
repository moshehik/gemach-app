import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { createImageVariants } from '@/lib/dressImageStorage';
import { ATTACHMENT_FILE_TYPES, fileExtension, IMAGE_EXTENSIONS, MAX_ATTACHMENT_FILES_TOTAL_BYTES } from '@/lib/attachmentFileTypes';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';

// POST (multipart) /api/admin/email-center/campaign/upload   file=<קובץ>  kind=image|file
//  image: תמונה לגוף הדיוור - עוברת המרה ב-sharp ל-JPEG (עד 1600px, בלי מטא-דאטה/תוכן פעיל), נשמרת ב-Attachment (הגשה ציבורית לפי UUID,
//         כמו תמונות הדגמים) כדי שתוצג בתיבת הדואר של הלקוחה. קבצים שאינם תמונות אמיתית נדחים.
//  file:  צרופה למייל - רשימת סיומות סגורה (מסמכים/תמונות), עד 3MB לקובץ (תקרת גוף הבקשה ב-Vercel). ה-mime נקבע בשרת לפי הסיומת.
// דורש עובד מחובר (הנהלה ראשית / מתכנת) - כמו שליחת דיוור.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  if (!allow(`ec-upload:${gate.employee.id}`, 40, 10 * 60 * 1000)) return NextResponse.json({ error: 'יותר מדי העלאות - נסו שוב בעוד כמה דקות' }, { status: 429 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = form.get('kind') === 'image' ? 'image' : 'file';
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    const name = String(file.name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
    const ext = fileExtension(name);
    if (kind === 'image') {
      if (!IMAGE_EXTENSIONS.includes(ext)) return NextResponse.json({ error: 'יש לבחור תמונה (png / jpg / gif / webp)' }, { status: 400 });
      if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'התמונה גדולה מדי (עד 4MB)' }, { status: 413 });
      const variants = await createImageVariants(Buffer.from(await file.arrayBuffer()));
      if (!variants) return NextResponse.json({ error: 'הקובץ אינו תמונה תקינה' }, { status: 400 });
      const row = await prisma.attachment.create({ data: { data: variants.web, contentType: variants.contentType }, select: { id: true } });
      return NextResponse.json({ success: true, attachmentId: row.id, url: `/api/attachment/${row.id}`, fileName: name.replace(/\.[^.]*$/, '') + '.jpg', size: variants.web.length });
    }
    if (!Object.prototype.hasOwnProperty.call(ATTACHMENT_FILE_TYPES, ext)) return NextResponse.json({ error: 'סוג הקובץ אינו מותר' }, { status: 400 });
    if (file.size > MAX_ATTACHMENT_FILES_TOTAL_BYTES) return NextResponse.json({ error: 'הקובץ גדול מדי (עד 3MB)' }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    const row = await prisma.attachment.create({ data: { data: buf, contentType: ATTACHMENT_FILE_TYPES[ext] }, select: { id: true } });
    return NextResponse.json({ success: true, attachmentId: row.id, url: `/api/attachment/${row.id}`, fileName: name, size: buf.length });
  } catch (e) {
    console.error('email-center upload failed', e);
    return NextResponse.json({ error: 'שגיאה בהעלאה' }, { status: 500 });
  }
}
