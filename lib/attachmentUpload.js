// עזר משותף ל-ErrorReport/ErrorReportReply.attachmentUrls - מעלה תמונות שהגיעו
// כ-data URL (צילומי מסך/אלמנט, ר' lib/clientCapture.js) ל-Vercel Blob דרך
// lib/dressImageStorage.js's storeBuffers (גנרי לחלוטין, לא תלוי בסוג קובץ),
// ומעביר כמו שהוא כל פריט שהוא כבר URL ציבורי (הקלטת מסך שהועלתה ישירות
// מהדפדפן - ר' useScreenRecorder.js, Phase 4).
import { storeBuffers } from './dressImageStorage';
import { ATTACHMENT_FILE_TYPES, MAX_ATTACHMENT_FILES_TOTAL_BYTES, fileExtension, isAllowedAttachmentFile, safeStoredName } from './attachmentFileTypes';

export async function uploadAttachmentDataUrls(items, prefix) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const files = [];
  const passthroughUrls = [];

  let fileBytes = 0;
  items.forEach((item, idx) => {
    // קובץ שצורף מהמחשב (וורד/אקסל/PDF/תמונה...): { name, dataUrl } - הסיומת קובעת את ה-mime.
    if (item && typeof item === 'object' && typeof item.dataUrl === 'string') {
      const m = /^data:[^;,]*(?:;[^;,]*)*;base64,(.*)$/.exec(item.dataUrl);
      if (!m || !isAllowedAttachmentFile(item.name)) return;
      const buffer = Buffer.from(m[1], 'base64');
      fileBytes += buffer.length;
      if (fileBytes > MAX_ATTACHMENT_FILES_TOTAL_BYTES) return;
      files.push({
        name: `${prefix}-${Date.now()}-${idx}-${safeStoredName(item.name)}`,
        buffer,
        contentType: ATTACHMENT_FILE_TYPES[fileExtension(item.name)],
        displayName: safeStoredName(item.name),
      });
      return;
    }
    const match = /^data:([^;]+);base64,(.*)$/.exec(item || '');
    if (!match) {
      if (item) passthroughUrls.push(item);
      return;
    }
    const [, mimeType, base64] = match;
    const ext = (mimeType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    files.push({
      name: `${prefix}-${Date.now()}-${idx}.${ext}`,
      buffer: Buffer.from(base64, 'base64'),
      contentType: mimeType,
    });
  });

  if (files.length === 0) return passthroughUrls;
  const urls = await storeBuffers(files);
  // קבצים מהמחשב מקבלים ?n=<שם קובץ> בכתובת - ה-Attachment לא שומר שם, וזה מה שמאפשר להציג
  // את השם ב-UI, לקבוע סיומת בהורדה, ולסקריפט הקריאה (scripts/read-error-attachments.js) לזהות סוג.
  const named = files.map((f) => {
    const u = urls[f.name];
    return f.displayName ? `${u}?n=${encodeURIComponent(f.displayName)}` : u;
  });
  return [...passthroughUrls, ...named];
}
