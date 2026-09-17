// Gemini Files API - להעלאת קבצים גדולים (הקלטות מסך) שלא מתאימים ל-inline
// base64 בתוך generateContent הרגיל. ר' lib/ai/gemini.js לקריאה הרגילה.
//
// חשוב: הפרויקט-האחות שנבדק (מערכת AI, GAS) מיישם את שלב ההעלאה בלבד בלי
// polling על מצב העיבוד (state) - קובץ וידאו לא הופך ל-ACTIVE מיידית, וקריאה
// ל-generateContent לפני שהוא ACTIVE נכשלת. waitForFileActive כאן משלים את
// הפער הזה.
import { getApiKey } from './gemini';

const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const FILES_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * מעלה buffer בודד ל-Gemini Files API (raw upload, לא resumable) ומחזיר
 * { uri, name } - name נדרש להמשך ה-polling, uri הוא מה שמצטרף ל-generateContent.
 */
export async function uploadFileToGemini(buffer, mimeType) {
  const apiKey = getApiKey();
  const res = await fetch(`${UPLOAD_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'raw',
      'Content-Type': mimeType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini file upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const file = data.file || data;
  if (!file?.uri || !file?.name) throw new Error('Gemini file upload returned no uri/name');
  return { uri: file.uri, name: file.name };
}

/**
 * ממתין עד שהקובץ (וידאו בעיקר) יהפוך ל-ACTIVE, עם timeout כולל.
 * זורק שגיאה ברורה אם הקובץ נכשל (FAILED) או שה-timeout פג.
 */
export async function waitForFileActive(fileName, { timeoutMs = 45000, intervalMs = 2000 } = {}) {
  const apiKey = getApiKey();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${FILES_BASE}/${fileName}?key=${apiKey}`);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini file status check failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.state === 'ACTIVE') return data;
    if (data.state === 'FAILED') throw new Error(`Gemini file processing failed: ${JSON.stringify(data.error || data)}`);

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Gemini file did not become ACTIVE in time (timeout)');
}

/**
 * העלאה + המתנה במכה אחת - מה שרוב הקוראים בפועל צריכים.
 */
export async function uploadAndWaitForFile(buffer, mimeType, opts) {
  const { uri, name } = await uploadFileToGemini(buffer, mimeType);
  await waitForFileActive(name, opts);
  return uri;
}
