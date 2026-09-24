// סוגי קבצים שמותר לצרף לדיווח תקלה/תגובה (ErrorReport / ErrorReportReply) מהמחשב.
// רשימה סגורה בכוונה: הקבצים מוגשים מאותו דומיין (/api/files), לכן HTML/SVG/JS לא מותרים
// (XSS). ה-mime נקבע בשרת לפי הסיומת - לא סומכים על מה שהדפדפן שלח.
// משותף ללקוח (ErrorReportButton.js) ולשרת (lib/attachmentUpload.js).

export const ATTACHMENT_FILE_TYPES = {
  // מסמכים - וורד, אקסל, פאוור פוינט, PDF, טקסט
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  rtf: 'application/rtf',
  // תמונות
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

// מגבלת גוף הבקשה ב-Vercel היא 4.5MB, וב-base64 הקובץ גדל ב-33% - לכן סה"כ צרופות-מהמחשב
// בבקשה אחת מוגבל ל-3MB.
export const MAX_ATTACHMENT_FILES_TOTAL_BYTES = 3 * 1024 * 1024;

export const ATTACHMENT_FILE_INPUT_ACCEPT = Object.keys(ATTACHMENT_FILE_TYPES).map((e) => `.${e}`).join(',');

export function fileExtension(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

export function isAllowedAttachmentFile(name) {
  return Object.prototype.hasOwnProperty.call(ATTACHMENT_FILE_TYPES, fileExtension(name));
}

export function isImageAttachmentName(name) {
  return IMAGE_EXTENSIONS.includes(fileExtension(name));
}

// שם קובץ בטוח לנתיב אחסון: ASCII בלבד (עברית נשמרת בשם המקורי רק בצד הלקוח; בשרת נשאר
// החלק הלטיני + הסיומת, כדי שכתובת ה-URL תהיה נקייה).
export function safeStoredName(name) {
  const ext = fileExtension(name);
  const base = String(name || '').replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${base || 'file'}.${ext}`;
}
