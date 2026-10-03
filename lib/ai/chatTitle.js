// lib/ai/chatTitle.js - כותרת אוטומטית לשיחה בצ'אט ה-AI (הכוכב בצד): נוצרת בתשובה הראשונה בשיחה.
// ESM טהור בלי imports של Next/prisma (נבדק ב-scripts/test_ai_chat_title.mjs). הקריאה ל-Gemini מוזרקת (generate),
// כך שאפשר לבדוק בלי רשת. כל כשל = null והלקוח נופל לתצוגה הקיימת (תחילת השאלה הראשונה).

export const TITLE_MAX_CHARS = 40;
export const TITLE_TIMEOUT_MS = 6000;

export function buildTitlePrompt(question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  return [
    'תן כותרת קצרה בעברית לשיחה שנפתחת בשאלה הבאה של עובד גמ"ח למערכת ניהול.',
    'דרישות: 2 עד 5 מילים, תיאור הנושא (לא ציטוט של השאלה), בלי מירכאות, בלי נקודה בסוף, בלי אימוג\'י,',
    'בלי מספרי טלפון או כתובות. החזר את הכותרת בלבד, בשורה אחת.',
    '',
    'השאלה: ' + q,
  ].join('\n');
}

// מנקה תשובת מודל לכותרת בטוחה לתצוגה; מחזיר '' כשאין כותרת סבירה.
export function cleanTitle(raw) {
  if (typeof raw !== 'string') return '';
  let t = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  t = t.replace(/^(כותרת|title)\s*[:：-]\s*/i, '');
  t = t.replace(/[*_`#>]+/g, '');
  t = t.replace(/^["'“”„‘’׳״]+|["'“”„‘’׳״]+$/g, '');
  t = t.replace(/[.:;!?،,\-–—\s]+$/g, '').replace(/\s+/g, ' ').trim();
  if (t.length < 2) return '';
  // כותרת בלי אות עברית = לא כותרת (למשל "No response generated" ש-lib/ai/gemini.js מחזיר בתשובה חסומה/ריקה)
  if (!/[א-ת]/.test(t)) return '';
  if (t.length > TITLE_MAX_CHARS) {
    const cut = t.slice(0, TITLE_MAX_CHARS);
    t = cut.slice(0, Math.max(cut.lastIndexOf(' '), 12)).trim();
  }
  return t;
}

// generate: async (prompt) => string. מחזיר כותרת נקייה או null (כשל / זמן קצוב / ריק). לא זורק.
export async function generateChatTitle(question, generate, timeoutMs = TITLE_TIMEOUT_MS) {
  const q = String(question || '').trim();
  if (!q || typeof generate !== 'function') return null;
  let timer;
  try {
    const raw = await Promise.race([
      generate(buildTitlePrompt(q)),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
    ]);
    return cleanTitle(raw) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
