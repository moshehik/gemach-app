// lib/consentDocsServer.js - המסמכים שהלקוחה מאשרת: קובץ התקנון (PDF/תמונה שהועלה בהגדרות) ומדיניות הפרטיות (טקסט).
// צד שרת בלבד (crypto + הגדרות). מקור אחד ל: עמוד /privacy, עמוד /terms, GET /api/public-terms, GET /api/public-consent-info, וגרסאות
// ההסכמה שנרשמות ביומן (lib/customerConsent.js docs.termsVersion / docs.privacyVersion).
//
// הגדרות (SystemSetting; כולן אופציונליות - שורה חסרה = אין קובץ תקנון / ברירת מחדל לטקסט הפרטיות):
//   terms_file_id        מזהה ה-Attachment של הקובץ שבתוקף           } נכתבים רק ע"י /api/admin/terms-file (POST /api/settings חוסם אותם)
//   terms_file_name      שם הקובץ להצגה                               }
//   terms_file_type      application/pdf | image/png | image/jpeg      }
//   terms_file_sha256    sha256 (hex) של תוכן הקובץ = גרסת התקנון      }
//   terms_file_uploaded_at  ISO של ההעלאה                            }
//   terms_file_history   JSON: [{id,name,type,sha256,uploadedAt}, ...] מהישן לחדש (הקבצים הישנים נשארים ב-DB כראיה)
//   privacy_policy_text  טקסט מדיניות הפרטיות (ריק = ברירת המחדל ב-lib/privacyPolicyDefault.js)

import { createHash } from 'node:crypto';
import { DEFAULT_PRIVACY_POLICY_TEXT, effectivePrivacyTemplate, renderPrivacyText, parsePolicyBlocks } from './privacyPolicyDefault.js';

export const TERMS_FILE_KEYS = Object.freeze(['terms_file_id', 'terms_file_name', 'terms_file_type', 'terms_file_sha256', 'terms_file_uploaded_at', 'terms_file_history']);
export const TERMS_ALLOWED_TYPES = Object.freeze({ 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' });
export const TERMS_MAX_BYTES = 4 * 1024 * 1024; // מתחת לתקרת גוף הבקשה של Vercel (4.5MB)
// תאריך "עודכן לאחרונה" של ברירת המחדל, כשאין שורת הגדרה (עדכנו בכל שינוי בטקסט ברירת המחדל)
export const DEFAULT_PRIVACY_UPDATED = '2026-10-12';

const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
export const hashText = (text) => createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 12);
export const hashBytes = (buf) => sha256Hex(buf);

/** סוג הקובץ לפי תוכנו (magic bytes) - לא סומכים על הסוג שהדפדפן שלח. null = לא נתמך. */
export function sniffTermsType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

/** שם קובץ בטוח להצגה / כותרת הורדה (בלי נתיבים, בלי תווי בקרה). */
export function safeTermsFileName(name, type) {
  const ext = TERMS_ALLOWED_TYPES[type] || 'pdf';
  const base = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.(pdf|png|jpe?g)$/i, '').slice(0, 80);
  return `${base || 'תקנון'}.${ext}`;
}

const getVal = (settings, key) => {
  if (!settings) return '';
  const v = typeof settings.get === 'function' ? settings.get(key) : settings[key];
  return typeof v === 'string' ? v : '';
};

export function parseTermsHistory(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.id === 'string' && typeof x.sha256 === 'string') : [];
  } catch { return []; }
}

/** המידע על קובץ התקנון שבתוקף (ללא הבייטים). null כשאין. */
export function currentTermsFile(settings) {
  const id = getVal(settings, 'terms_file_id');
  const sha256 = getVal(settings, 'terms_file_sha256');
  const type = getVal(settings, 'terms_file_type');
  if (!id || !sha256 || !TERMS_ALLOWED_TYPES[type]) return null;
  return { id, sha256, type, name: getVal(settings, 'terms_file_name') || safeTermsFileName('', type), uploadedAt: getVal(settings, 'terms_file_uploaded_at') || null };
}

/** פרטי הקשר מהגדרות הגמ"ח (שני הגמ"חים שונים; מה שריק לא מוצג). */
export function contactLinesFromSettings(settings) {
  const name = getVal(settings, 'gmach_name');
  const lines = [];
  const phone = getVal(settings, 'gmach_phone').trim();
  const email = getVal(settings, 'main_email').trim();
  const address = getVal(settings, 'gmach_address').trim();
  if (name.trim()) lines.push(name.trim());
  if (email) lines.push(`דוא"ל: ${email}`);
  if (phone) lines.push(`טלפון: ${phone}`);
  if (address) lines.push(`כתובת: ${address}`);
  return lines.length > 1 ? lines : [];
}

/**
 * מדיניות הפרטיות בפועל. settings = Map/אובייקט של key->value; rows (אופציונלי) = שורות SystemSetting כדי לדעת את updatedAt של הטקסט.
 * @returns {{text:string, blocks:object[], version:string, updatedAt:string, custom:boolean}}
 */
export function resolvePrivacyPolicy(settings, rows) {
  const custom = getVal(settings, 'privacy_policy_text').trim().length > 0;
  const template = effectivePrivacyTemplate(getVal(settings, 'privacy_policy_text'));
  const text = renderPrivacyText(template, { name: getVal(settings, 'gmach_name'), contactLines: contactLinesFromSettings(settings) });
  let updatedAt = DEFAULT_PRIVACY_UPDATED;
  if (custom && Array.isArray(rows)) {
    const row = rows.find((r) => r && r.key === 'privacy_policy_text');
    if (row && row.updatedAt) updatedAt = new Date(row.updatedAt).toISOString().slice(0, 10);
  }
  return { text, blocks: parsePolicyBlocks(text), version: hashText(text), updatedAt, custom };
}

/** כל מה שהסכמה צריכה לדעת על המסמכים שבתוקף (נרשם ביומן, מוחזר ל-GET /api/public-consent-info). */
export function resolveConsentDocs(settings, rows) {
  const terms = currentTermsFile(settings);
  const privacy = resolvePrivacyPolicy(settings, rows);
  return {
    hasTermsFile: !!terms,
    termsVersion: terms ? terms.sha256 : null,
    termsRef: terms ? terms.id : null,
    termsName: terms ? terms.name : null,
    termsType: terms ? terms.type : null,
    termsUploadedAt: terms ? terms.uploadedAt : null,
    privacyVersion: privacy.version,
    privacyUpdatedAt: privacy.updatedAt,
  };
}

export { DEFAULT_PRIVACY_POLICY_TEXT };
