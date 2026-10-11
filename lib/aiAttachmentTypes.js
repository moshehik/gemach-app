// קבצים שאפשר לצרף לשאלה בחלונית עוזר ה-AI (app/components/AIFloatingWidget.js) ושהעוזר באמת יכול לקרוא.
// בניגוד לדיווח תקלה (שרק מאחסן את הקובץ), כאן הקובץ נשלח ל-Gemini - ולכן רק תת-קבוצה של
// lib/attachmentFileTypes.js: תמונות (PNG/JPG/WEBP), PDF וטקסט פשוט (TXT/CSV). וורד/אקסל/פאוור פוינט/RTF
// ו-GIF נדחים כבר בבחירה, עם הסבר - ולא "מצורפים לעיון" (בחלונית אין לאן לשמור אותם, והעוזר לא היה קורא אותם).
// משותף ללקוח (בחירה/בדיקה) ולשרת (lib/ai/aiFiles.js, בדיקה חוזרת - לא סומכים על הלקוח).
import { ATTACHMENT_FILE_TYPES, MAX_ATTACHMENT_FILES_TOTAL_BYTES, fileExtension } from './attachmentFileTypes';

export const AI_FILE_MAX_COUNT = 5;
// אותה מגבלת גודל כמו בדיווח תקלה (גוף בקשה ב-Vercel עד 4.5MB, base64 מנפח ב-33%) - כולל צילום מסך שכבר ממתין.
export const AI_FILES_MAX_TOTAL_BYTES = MAX_ATTACHMENT_FILES_TOTAL_BYTES;
export const AI_TEXT_MAX_CHARS = 30000;

export const AI_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const AI_TEXT_EXTENSIONS = ['txt', 'csv'];
export const AI_READABLE_EXTENSIONS = [...AI_IMAGE_EXTENSIONS, 'pdf', ...AI_TEXT_EXTENSIONS];

export const AI_FILE_INPUT_ACCEPT = AI_READABLE_EXTENSIONS.map((e) => `.${e}`).join(',');
export const AI_FILE_ALLOWED_LABEL = 'תמונות (PNG, JPG, WEBP), PDF, טקסט או CSV';

export function isAiReadableFile(name) {
  return AI_READABLE_EXTENSIONS.includes(fileExtension(name));
}
export function isAiImageName(name) {
  return AI_IMAGE_EXTENSIONS.includes(fileExtension(name));
}
export function isAiTextName(name) {
  return AI_TEXT_EXTENSIONS.includes(fileExtension(name));
}
// ה-mime נקבע לפי הסיומת (כמו ב-lib/attachmentUpload.js), בלי ה-charset.
export function aiFileMimeType(name) {
  const full = ATTACHMENT_FILE_TYPES[fileExtension(name)];
  return full ? full.split(';')[0] : '';
}

// בדיקה בבחירה: מחזיר { file, ok, error } לכל קובץ. currentBytes = גודל מה שכבר ממתין (קבצים + צילום מסך), currentCount = כמות הקבצים הממתינים.
export function validateAiFiles(files, { currentBytes = 0, currentCount = 0 } = {}) {
  let total = currentBytes;
  let count = currentCount;
  return (files || []).map((f) => {
    if (!isAiReadableFile(f.name)) {
      return { file: f, ok: false, error: `"${f.name}" - העוזר לא יכול לקרוא סוג קובץ זה. אפשר לצרף: ${AI_FILE_ALLOWED_LABEL}` };
    }
    if (count >= AI_FILE_MAX_COUNT) {
      return { file: f, ok: false, error: `אפשר לצרף עד ${AI_FILE_MAX_COUNT} קבצים לשאלה אחת` };
    }
    if (total + f.size > AI_FILES_MAX_TOTAL_BYTES) {
      return { file: f, ok: false, error: `"${f.name}" גדול מדי - סה"כ הצרופות מוגבל ל-3MB` };
    }
    total += f.size;
    count += 1;
    return { file: f, ok: true };
  });
}
