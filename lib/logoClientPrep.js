// הכנת קובץ לוגו בדפדפן לפני ההעלאה (בטוח לקליינט, בלי sharp). הדחיסה האמיתית נעשית בשרת (lib/logoCompress.js);
// כאן רק מקטינים קובץ גדול מאוד (צילום מצלמה ועוד) כדי לא לחרוג ממגבלת גוף הבקשה של Vercel (~4.5MB) - הדחיסה בשרת אינה תלויה בזה.
export const LOGO_CLIENT_PREP_THRESHOLD = 3.5 * 1024 * 1024;
const PREP_MAX_PX = 1600;

export async function prepareLogoFile(file) {
  try {
    if (!file || file.size <= LOGO_CLIENT_PREP_THRESHOLD) return file;
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type || '')) return file; // SVG וכד' - אין מה לצייר
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, PREP_MAX_PX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'logo').replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  } catch {
    return file; // בכל תקלה - מעלים את המקור כמו שהוא והשרת יחליט
  }
}
