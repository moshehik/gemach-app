// דחיסת לוגו - מודול משותף לנתיב ההעלאה (app/api/upload-logo/route.js) ולסקריפט ההמרה החד-פעמי
// (scripts/compress_brand_logo.js). המקור שהועלה לעולם לא נשמר: נשמר רק התוצר הדחוס כ-data URL ב-SystemSetting BRAND_LOGO.
//
// למה: הלוגו של הגמח הראשי היה base64 של 2.48MB ונקרא מה-DB בכל אינסטנס קר ובכל קריאת הגדרות (ר' docs/cpu-measurement-2026-10-06.md).
//
// אסטרטגיה: מקטינים לכל היותר LOGO_MAX_PX בצד הארוך (בלי הגדלה), שומרים שקיפות, ובוחרים את התוצר הקטן מבין
// PNG מצומצם-פלטה (חד ללוגואים שטוחים) ו-WebP עם אלפא. אם התוצאה גדולה מהיעד - לולאת איכות יורדת, ואחריה הקטנת מימדים.
// אם גם אחרי הכול התוצר גדול מהתקרה הקשיחה (LOGO_HARD_CAP_BYTES) - נזרקת שגיאה בעברית.

export const LOGO_MAX_PX = 512;
export const LOGO_TARGET_BYTES = 100 * 1024; // יעד: עד ~100KB
export const LOGO_HARD_CAP_BYTES = 300 * 1024; // תקרה קשיחה: מעל זה לא נשמר
export const LOGO_MAX_INPUT_BYTES = 12 * 1024 * 1024; // קובץ מקור מעל זה נדחה (מגן על הזיכרון של הפונקציה)
const MIN_PX = 96;
const WEBP_QUALITIES = [85, 70, 55, 40];
const ALLOWED_INPUT_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'heif', 'tiff']);

export class LogoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LogoError';
    this.code = code; // 'not-image' | 'too-large-input' | 'too-large-output' | 'empty'
  }
}

/** פירוק data URL ל-{ mime, buffer }; מחזיר null אם זה לא data URL של base64. */
export function parseDataUrl(value) {
  if (typeof value !== 'string') return null;
  const m = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+)?(?:;[a-zA-Z0-9=.+-]+)*;base64,(.*)$/s.exec(value);
  if (!m) return null;
  return { mime: m[1] || 'application/octet-stream', buffer: Buffer.from(m[2], 'base64') };
}

export function toDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function loadSharp() {
  return (await import('sharp')).default;
}

// source = { raw, width, height, channels } - הפיקסלים כבר מסובבים ומוקטנים ל-maxPx (מפענחים את המקור פעם אחת בלבד)
async function encodeCandidates(sharp, source, px, quality, withPalette) {
  const base = () => sharp(source.raw, { raw: { width: source.width, height: source.height, channels: source.channels } })
    .resize(px, px, { fit: 'inside', withoutEnlargement: true });
  const out = [];
  // PNG מצומצם-פלטה: חד וקטן ללוגואים שטוחים (שומר אלפא). רק באיטרציה הראשונה בכל גודל (יקר, ולא תלוי ב-quality של WebP)
  if (withPalette) {
    try {
      const { data, info } = await base()
        .png({ palette: true, quality: Math.min(100, quality + 10), effort: 7, compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      out.push({ buffer: data, mime: 'image/png', width: info.width, height: info.height });
    } catch { /* פורמט הפלטה לא זמין - ממשיכים ל-WebP */ }
  }
  const w = await base().webp({ quality, effort: 4, alphaQuality: Math.min(100, quality + 12) }).toBuffer({ resolveWithObject: true });
  out.push({ buffer: w.data, mime: 'image/webp', width: w.info.width, height: w.info.height });
  return out;
}

/**
 * מכווץ את הלוגו (Buffer של קובץ תמונה כלשהו).
 * מחזיר { buffer, mime, width, height, originalBytes, bytes, steps } או זורק LogoError.
 */
export async function compressLogoBuffer(input, options = {}) {
  const maxPx = options.maxPx || LOGO_MAX_PX;
  const target = options.targetBytes || LOGO_TARGET_BYTES;
  const hardCap = options.hardCapBytes || LOGO_HARD_CAP_BYTES;
  if (!input || !input.length) throw new LogoError('empty', 'הקובץ ריק');
  if (input.length > LOGO_MAX_INPUT_BYTES) {
    throw new LogoError('too-large-input', `הקובץ גדול מדי (${(input.length / 1048576).toFixed(1)}MB). אפשר להעלות עד ${LOGO_MAX_INPUT_BYTES / 1048576}MB`);
  }
  const sharp = await loadSharp();
  let meta;
  try {
    meta = await sharp(input, { failOn: 'none', limitInputPixels: 80e6 }).metadata();
  } catch {
    throw new LogoError('not-image', 'הקובץ אינו תמונה תקינה. יש להעלות PNG, JPG, WebP או GIF');
  }
  if (!meta || !meta.format || !ALLOWED_INPUT_FORMATS.has(meta.format)) {
    throw new LogoError('not-image', 'הקובץ אינו תמונה תקינה. יש להעלות PNG, JPG, WebP או GIF');
  }

  // פענוח + סיבוב EXIF + הקטנה ל-maxPx פעם אחת; כל הניסיונות הבאים עובדים על הפיקסלים הקטנים
  // SVG: ברירת המחדל מרנדרת בגודל האינטרינזי (24x24 נשאר 24x24) - מעלים density כך שהצד הארוך מגיע ל-maxPx (72dpi = גודל אינטרינזי)
  const opts = { failOn: 'none', limitInputPixels: 80e6 };
  if (meta.format === 'svg') opts.density = Math.min(2400, Math.max(72, Math.ceil((72 * maxPx) / Math.max(meta.width || 1, meta.height || 1))));
  const prepared = await sharp(input, opts)
    .rotate()
    .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const source = { raw: prepared.data, width: prepared.info.width, height: prepared.info.height, channels: prepared.info.channels };

  let best = null;
  let steps = 0;
  let px = maxPx;
  while (px >= MIN_PX) {
    for (const quality of WEBP_QUALITIES) {
      steps += 1;
      const cands = await encodeCandidates(sharp, source, px, quality, quality === WEBP_QUALITIES[0]);
      const smallest = cands.reduce((a, b) => (a.buffer.length <= b.buffer.length ? a : b));
      if (!best || smallest.buffer.length < best.buffer.length) best = smallest;
      if (smallest.buffer.length <= target) {
        return finish(smallest, input.length, steps);
      }
    }
    // גם באיכות הנמוכה ביותר עדיין גדול מהיעד - מקטינים מימדים (פי 0.75)
    px = Math.floor(px * 0.75);
  }
  if (best && best.buffer.length <= hardCap) return finish(best, input.length, steps);
  throw new LogoError('too-large-output', 'לא ניתן לדחוס את התמונה לגודל סביר. יש להעלות תמונה פשוטה יותר או קטנה יותר');
}

function finish(c, originalBytes, steps) {
  return { buffer: c.buffer, mime: c.mime, width: c.width, height: c.height, originalBytes, bytes: c.buffer.length, steps };
}

/**
 * מכווץ ערך שמור (data URL) ומחזיר גם את ה-data URL החדש. ערך שאינו data URL של תמונה => LogoError.
 */
export async function compressLogoDataUrl(value, options = {}) {
  const parsed = parseDataUrl(value);
  if (!parsed) throw new LogoError('not-image', 'הערך השמור אינו data URL של תמונה');
  const r = await compressLogoBuffer(parsed.buffer, options);
  return { ...r, dataUrl: toDataUrl(r.buffer, r.mime), originalDataUrlLength: String(value).length };
}
