// lib/emailText.js - עזרי טקסט למרכז המיילים (טהור: בלי Prisma/next, בטוח גם בלקוח).
//
// * fillVars:  החלפת {{משתנה}} בערך. הערך הוא טקסט רגיל - ה-HTML נבנה ב-lib/emailTemplates.js שמבצע escape לכל טקסט,
//              ולכן ערך עם < > & " ' אינו יכול להפוך לתגית (אין "HTML של משתמש" בתבניות). בנושא (כותרת מייל) ירידות שורה מוסרות.
// * findUnknownVars / validateText: אימות בשמירה - משתנה שלא קיים למייל הזה נדחה (ולא נעלם בשקט במייל).
// * renderRichText: לדיוורים בלבד - טקסט חופשי שמקבל **הדגשה** ו-[טקסט](https://קישור) בלבד; הכול עובר escape לפני ההמרה,
//   וקישורים מותרים רק http/https/mailto (אין javascript: / data:). זה ה"סניטייזר" של גוף הדיוור: אין דרך להכניס תגית.

const VAR_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export const MAX_LINE_LENGTH = 1200; // תו - שורה בודדת בתבנית
export const MAX_SUBJECT_LENGTH = 200;

// תווי בקרה (חוץ מירידת שורה וטאב) - מוסרים תמיד
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** מנקה טקסט שהוזן בעורך: תווי בקרה, CRLF -> LF, חיתוך אורך. */
export function cleanTextInput(value, { max = MAX_LINE_LENGTH, multiline = true } = {}) {
  let s = typeof value === 'string' ? value : '';
  s = s.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '');
  if (!multiline) s = s.replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  return s.trim().slice(0, max);
}

/** החלפת {{x}} בערכים. ערך חסר/null -> ''. subject=true: ירידות שורה הופכות לרווח. */
export function fillVars(template, vars = {}, { subject = false } = {}) {
  const out = String(template ?? '').replace(VAR_RE, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
  return subject ? out.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : out;
}

/** כל שמות המשתנים שמופיעים בטקסט. */
export function varsInText(template) {
  const found = [];
  String(template ?? '').replace(VAR_RE, (_m, k) => { if (!found.includes(k)) found.push(k); return ''; });
  return found;
}

/** משתנים שאינם ברשימה המותרת. */
export function findUnknownVars(template, allowedKeys) {
  const allowed = new Set(allowedKeys);
  return varsInText(template).filter((k) => !allowed.has(k));
}

/** סוגריים מסולסלים כפולים שלא נסגרו כראוי ("{{שם" / "{{ }}" / "{{שם}"). */
export function hasBrokenBraces(template) {
  const stripped = String(template ?? '').replace(VAR_RE, '');
  return /\{\{|\}\}/.test(stripped);
}

/**
 * אימות שורה לפני שמירה. מחזיר מחרוזת שגיאה בעברית או null.
 * @param {string} text  @param {string[]} allowedKeys  @param {{label?:string, required?:boolean}} [opts]
 */
export function validateText(text, allowedKeys, { label = 'השורה', required = false, max = MAX_LINE_LENGTH } = {}) {
  if (typeof text !== 'string') return `${label}: ערך לא תקין`;
  if (required && !text.trim()) return `${label}: לא יכול להיות ריק`;
  if (text.length > max) return `${label}: ארוך מדי (עד ${max} תווים)`;
  if (hasBrokenBraces(text)) return `${label}: סוגריים מסולסלים לא תקינים - משתנה נכתב כך: {{שם_המשתנה}}`;
  const unknown = findUnknownVars(text, allowedKeys);
  if (unknown.length) return `${label}: משתנה לא מוכר ${unknown.map((k) => `{{${k}}}`).join(', ')}`;
  return null;
}

// ---------------------------------------------------------------------------
// טקסט עשיר מוגבל לדיוורים
// ---------------------------------------------------------------------------

const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** קישור בטוח: http/https/mailto בלבד, בלי רווחים/תווי בקרה. מחזיר את הכתובת או null. */
export function safeUrl(url) {
  const u = String(url ?? '').trim();
  if (!u || u.length > 2000 || /[\s\u0000-\u001f<>"']/.test(u)) return null;
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

/**
 * ממיר שורת טקסט (כבר escaped!) ל-HTML עם **הדגשה** ו-[טקסט](קישור). הקישור נבדק ב-safeUrl; קישור לא בטוח נשאר טקסט רגיל.
 * הקלט חייב להיות escaped - הפונקציה מניחה שאין בו תגיות, ולכן ההמרות לא יכולות להכניס תגית שלא מרשימת ההיתר (strong, a).
 */
function inlineMarkup(escapedLine) {
  return escapedLine
    .replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)/g, (m, label, rawUrl) => {
      // ה-URL עבר escape (&amp; וכו') - מפענחים רק את מה ש-escapeHtml יצר כדי לבדוק אותו
      const decoded = rawUrl.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const ok = safeUrl(decoded);
      return ok ? `<a href="${escapeHtml(ok)}" style="color:#8a3457;font-weight:700">${label}</a>` : m;
    })
    .replace(/\*\*([^*\n]{1,300})\*\*/g, '<strong>$1</strong>');
}

const RTL = 'direction:rtl;text-align:right;unicode-bidi:embed';

/** גוף דיוור מטקסט חופשי -> HTML בטוח (כל שורה בלוק RTL; שורה ריקה = מרווח). אפשר להעביר ערכי משתנים (escape אוטומטי). */
export function renderRichText(text, vars = null) {
  const src = vars ? fillVars(text, vars) : String(text ?? '');
  return src.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    if (line.trim() === '') return '<div style="height:10px;line-height:10px">&nbsp;</div>';
    return `<div dir="rtl" style="${RTL}">${inlineMarkup(escapeHtml(line))}</div>`;
  }).join('');
}

/** גרסת טקסט פשוט של אותו גוף: ללא סימוני ההדגשה; קישור [טקסט](url) הופך ל"טקסט (url)". */
export function richTextToPlain(text, vars = null) {
  const src = vars ? fillVars(text, vars) : String(text ?? '');
  return src.replace(/\r\n?/g, '\n')
    .replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)/g, (m, label, url) => (safeUrl(url) ? `${label} (${url})` : m))
    .replace(/\*\*([^*\n]{1,300})\*\*/g, '$1');
}

// ---------------------------------------------------------------------------
// טקסט פשוט מתוך HTML של מייל
// ---------------------------------------------------------------------------

/**
 * גרסת הטקסט הפשוט של המייל: כשהמייל נערך (cfg.customized) - נגזרת מה-HTML כדי שלא תישאר מנוסחת בטקסט הישן; אחרת הטקסט המקורי של האתר.
 * (Gmail מציג את ה-HTML; הטקסט הפשוט הוא לקליינטים בלי HTML וליומן.)
 */
export function cfgPlain(cfg, defaultBody, html) {
  if (!cfg || !cfg.customized || !html) return defaultBody;
  return htmlToPlain(html) || defaultBody;
}

export function htmlToPlain(html) {
  const a = String(html).indexOf('<!--EMAIL_CARD_START-->');
  const b = String(html).indexOf('<!--EMAIL_CARD_END-->');
  const card = a >= 0 && b > a ? String(html).slice(a, b) : String(html);
  return card
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(div|tr|p|h[1-6]|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
