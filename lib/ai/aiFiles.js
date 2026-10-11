// צד שרת: הופך את הקבצים ש-AIFloatingWidget שלח (files: [{ name, data(base64) }]) לקלט ל-Gemini.
// בדיקה חוזרת של סוג/כמות/גודל (הלקוח לא נסמך), ה-mime נקבע לפי הסיומת. תמונות ו-PDF עוברים כ-inline_data;
// TXT/CSV מפוענחים לטקסט ונכנסים לפרומפט (מוגבל באורך) - אמין יותר מ-inline_data לטקסט.
import { AI_FILE_MAX_COUNT, AI_FILES_MAX_TOTAL_BYTES, AI_TEXT_MAX_CHARS, AI_FILE_ALLOWED_LABEL, aiFileMimeType, isAiReadableFile, isAiTextName } from '../aiAttachmentTypes';

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// מחזיר { media, textBlocks, names } או { error } (הודעה בעברית להצגה למשתמש).
export function prepareAiFiles(raw, { extraBytes = 0 } = {}) {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) return { media: [], textBlocks: [], names: [] };
  if (!Array.isArray(raw)) return { error: 'רשימת הקבצים המצורפים אינה תקינה.' };
  if (raw.length > AI_FILE_MAX_COUNT) return { error: `אפשר לצרף עד ${AI_FILE_MAX_COUNT} קבצים לשאלה אחת.` };

  const media = [];
  const textBlocks = [];
  const names = [];
  let total = extraBytes;
  for (const f of raw) {
    const name = String((f && f.name) || '').slice(0, 120);
    const data = f && typeof f.data === 'string' ? f.data : '';
    if (!isAiReadableFile(name)) return { error: `הקובץ "${name}" אינו נתמך. אפשר לצרף: ${AI_FILE_ALLOWED_LABEL}.` };
    if (!data || !BASE64_RE.test(data)) return { error: `הקובץ "${name}" אינו תקין.` };
    const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
    total += bytes;
    if (total > AI_FILES_MAX_TOTAL_BYTES) return { error: 'הקבצים המצורפים גדולים מדי - סה"כ עד 3MB.' };
    names.push(name);
    if (isAiTextName(name)) {
      const text = Buffer.from(data, 'base64').toString('utf8').replace(/^﻿/, '');
      const clipped = text.length > AI_TEXT_MAX_CHARS ? `${text.slice(0, AI_TEXT_MAX_CHARS)}\n[...הטקסט נחתך]` : text;
      textBlocks.push(`--- ${name} ---\n${clipped}`);
    } else {
      media.push({ mimeType: aiFileMimeType(name), data });
    }
  }
  return { media, textBlocks, names };
}
