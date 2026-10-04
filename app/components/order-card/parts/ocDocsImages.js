// ocDocsImages.js — טעינת תמונות הדגמים לדף "תמונות דגמים" (A8, AMB-11): כל תמונה נטענת מהאתר (DressModel.imageUrl / thumbnailUrl - נשמרות ב-DB כ-Attachment,
// /api/attachment/<id>), מוקטנת ב-canvas ל-JPEG ומוטמעת כ-data URI, כי /api/pdf (מצב html) חוסם כל בקשת רשת חוץ מ-data: וגם מגביל את גודל ה-HTML (3MB).
// רץ בדפדפן בלבד (createImageBitmap + canvas); הלוגיקה סביבו (modelPhotosOf / loadModelPhotos) נבדקת ב-node עם ממיר מוזרק.
import { MAX_MODEL_PHOTOS, modelPhotosOf } from './ocDocsLogic';

const MAX_PX = 800;
const JPEG_QUALITY = 0.78;
// תקרת גודל כוללת לתמונות המוטמעות (תווים של data URI) - מתחת למגבלת 3MB של /api/pdf, עם מרווח ל-HTML
export const MAX_TOTAL_DATA_URI_CHARS = 2_300_000;

/** תמונה מכתובת -> data URI מוקטן. זורק שגיאה כשאי אפשר לטעון/לפענח (הקורא ממשיך לתמונה/דגם הבא) */
export async function imageUrlToDataUri(url, { fetchImpl = fetch, maxPx = MAX_PX, quality = JPEG_QUALITY } = {}) {
  const res = await fetchImpl(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`תמונה לא זמינה (${res.status})`);
  const blob = await res.blob();
  if (!/^image\//.test(blob.type || '')) throw new Error('הקובץ אינו תמונה');
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // שקיפות (PNG) לא נהפכת לשחור ב-JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

/**
 * התמונות של דגמי ההזמנה: לכל דגם מנסים את imageUrl ואז את thumbnailUrl; דגם שאף אחת מהן לא נטענה נזרק (לא מפיל את המייל).
 * @returns {Promise<Array<{name:string, sizes:string[], dataUri:string}>>}
 */
export async function loadModelPhotos(items, { toDataUri = imageUrlToDataUri, maxTotal = MAX_TOTAL_DATA_URI_CHARS } = {}) {
  const out = [];
  let total = 0;
  for (const model of modelPhotosOf(items).slice(0, MAX_MODEL_PHOTOS)) {
    let dataUri = null;
    for (const url of model.urls) {
      try { dataUri = await toDataUri(url); if (dataUri) break; } catch { /* הכתובת הבאה */ }
    }
    if (!dataUri) continue;
    if (total + dataUri.length > maxTotal) break;
    total += dataUri.length;
    out.push({ name: model.name, sizes: model.sizes, dataUri });
  }
  return out;
}
