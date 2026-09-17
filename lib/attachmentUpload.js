// עזר משותף ל-ErrorReport/ErrorReportReply.attachmentUrls - מעלה תמונות שהגיעו
// כ-data URL (צילומי מסך/אלמנט, ר' lib/clientCapture.js) ל-Vercel Blob דרך
// lib/dressImageStorage.js's storeBuffers (גנרי לחלוטין, לא תלוי בסוג קובץ),
// ומעביר כמו שהוא כל פריט שהוא כבר URL ציבורי (הקלטת מסך שהועלתה ישירות
// מהדפדפן - ר' useScreenRecorder.js, Phase 4).
import { storeBuffers } from './dressImageStorage';

export async function uploadAttachmentDataUrls(items, prefix) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const files = [];
  const passthroughUrls = [];

  items.forEach((item, idx) => {
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
  return [...passthroughUrls, ...Object.values(urls)];
}
