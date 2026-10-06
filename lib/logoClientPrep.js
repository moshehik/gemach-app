// הכנת קובץ לוגו בדפדפן לפני ההעלאה (בטוח לקליינט, בלי sharp). הדחיסה האמיתית נעשית בשרת (lib/logoCompress.js, תקרה 512px);
// כאן רק מקטינים קובץ גדול מאוד (צילום מצלמה ועוד) כדי לא לחרוג ממגבלת גוף הבקשה של Vercel (~4.5MB).
// הקטנה ל-1024px (פי 2 מהיעד של השרת - נשאר מקום לדחיסה איכותית), JPEG כשאין שקיפות ו-WebP כשיש; אם התוצר עדיין גדול - מקטינים שוב.
export const LOGO_CLIENT_PREP_THRESHOLD = 3.5 * 1024 * 1024;
export const LOGO_CLIENT_TARGET_BYTES = 3 * 1024 * 1024;
const PREP_MAX_PX = 1024;

function hasTransparency(ctx, w, h) {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  } catch { return true; } // לא ניתן לבדוק - נניח שקיפות (WebP שומר אותה)
  return false;
}

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

export async function prepareLogoFile(file) {
  try {
    if (!file || file.size <= LOGO_CLIENT_PREP_THRESHOLD) return file;
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type || '')) return file; // SVG וכד' - אין מה לצייר
    const bmp = await createImageBitmap(file);
    let px = PREP_MAX_PX;
    let best = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const scale = Math.min(1, px / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const alpha = hasTransparency(ctx, canvas.width, canvas.height);
      const blob = await toBlob(canvas, alpha ? 'image/webp' : 'image/jpeg', 0.88); // דפדפן בלי תמיכה ב-WebP מחזיר PNG
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (blob && blob.size <= LOGO_CLIENT_TARGET_BYTES) break;
      px = Math.round(px * 0.6);
    }
    if (bmp.close) bmp.close();
    if (!best || best.size >= file.size) return file;
    const ext = best.type === 'image/jpeg' ? 'jpg' : best.type === 'image/webp' ? 'webp' : 'png';
    return new File([best], (file.name || 'logo').replace(/\.[^.]+$/, '') + '.' + ext, { type: best.type });
  } catch {
    return file; // בכל תקלה - מעלים את המקור כמו שהוא והשרת יחליט
  }
}
