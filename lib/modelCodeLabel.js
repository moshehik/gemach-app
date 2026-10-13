// lib/modelCodeLabel.js - תווית "דגם + מספר" בלי כפל. בנווה יעקב אין שמות לדגמים: השם הוא המספר עצמו, ולכן "522 (קוד: 522)" הודפס "522 (522)" והמדבקה
// "522 - 522" (דיווח 12.10.2026, "דפי הכנות"). הכלל: אם השם ריק או זהה למספר הדגם (אחרי trim, רווחים, אפסים מובילים וספרות ערביות) או "דגם <מספר>" —
// מציגים את המספר פעם אחת; אם יש שם תיאורי אמיתי ושונה — "שם (מספר)" כרגיל. מודול טהור, בלי imports (שרת + דפדפן + בדיקות).
//
// קשר ל-lib/modelDisplay.js (ענף feature/neve-model-numbers-2026-10-12, עדיין לא ב-main): שם הוא מקור האמת ל"שם תצוגה" (שם אמיתי / מספר / "ללא שם").
// כאן רק כפל שם=מספר. כשהענף ימוזג, אפשר להחליף את isSameModelCode ב-!modelHasRealName(...) - נקודת החלפה אחת (השורה המסומנת למטה).

const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** מפתח השוואה למספר דגם: trim, רווחים מכווצים, ספרות ערביות -> לטיניות, אפסים מובילים בספרות בלבד ("0522" ≡ "522"), אותיות לטיניות באותיות קטנות. */
export function normModelCode(v) {
  let s = String(v ?? '').replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) & 0xF)).replace(/\s+/g, ' ').trim().toLowerCase();
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
}

/** האם `name` הוא בעצם אותו מספר דגם כמו `code` ("522" / "0522" / "דגם 522"); ריק משני הצדדים = לא. */
export function isSameModelCode(name, code) {
  const c = normModelCode(code);
  if (!c) return false;
  const n = normModelCode(name);
  if (n === c) return true;
  const auto = /^דגם (\S+)$/.exec(n);
  return !!auto && normModelCode(auto[1]) === c;
}

/**
 * "שם - מספר" (כמו מדבקות/דפי תיקונים) בלי כפל: ללא שם -> המספר; ללא מספר -> השם; שם=מספר -> המספר פעם אחת; אחרת `${name}${sep}${code}`.
 * מחזיר '' כששניהם ריקים (הקורא בוחר ברירת מחדל).
 */
export function modelNameWithCode(name, code, sep = ' - ') {
  const n = String(name ?? '').trim();
  const c = String(code ?? '').trim();
  if (!n) return c;
  if (!c) return n;
  return isSameModelCode(n, c) ? c : `${n}${sep}${c}`; // <- נקודת ההחלפה ל-modelHasRealName של lib/modelDisplay.js
}

/**
 * "שם (מספר)" לשדות בחירה / תוויות מסך (בורר דגם, חיפוש תפוסה): שם=מספר -> המספר פעם אחת; בלי שם -> המספר; בלי מספר -> השם; אחרת `${name} (${code})`.
 * אותו כלל כמו modelNameWithCode, רק עם סוגריים במקום מפריד.
 */
export function modelNameWithParenCode(name, code) {
  const n = String(name ?? '').trim();
  const c = String(code ?? '').trim();
  if (!n) return c;
  if (!c) return n;
  return isSameModelCode(n, c) ? c : `${n} (${c})`;
}

/** מכווץ "522 (קוד: 522)" ל-"522" וגם "X (קוד: 440)" נשאר כמו שהוא (מילת "קוד" נשמרת) - למשטחי מסך/ייצוא שלא מדפיסים "(440)" בלבד. */
export function collapseSameCodeLabel(text) {
  const s = String(text ?? '');
  const m = CODE_LABEL_RE.exec(s);
  if (!m) return s;
  const before = s.slice(0, m.index).trim();
  const code = m[1].trim();
  if (!code || !before || !isSameModelCode(before, code)) return s;
  return `${code}${s.slice(m.index + m[0].length)}`.trim();
}

const CODE_LABEL_RE = /\(קוד:\s*([^)]*)\)/;
const CODE_LABEL_RE_G = /\(קוד:\s*([^)]*)\)/g;

/**
 * תיאור פריט שמור ("אבן חרוזים (קוד: 440)") להדפסה: "אבן חרוזים (440)"; כשהשם זהה למספר ("522 (קוד: 522)") -> "522" (פעם אחת); שם ריק -> "(440)";
 * תווית עם קוד ריק ("שם (קוד: )") נמחקת. טקסט שאחרי התווית (" - פירוט") נשמר. הכללים כאן הם היחידים - הדפסת הזמנה, מייל הזמנה, הכנות.
 */
export function stripCodeLabel(text) {
  const s = String(text ?? '');
  const m = CODE_LABEL_RE.exec(s);
  if (!m) return s;
  const before = s.slice(0, m.index).trim();
  const code = m[1].trim();
  const after = s.slice(m.index + m[0].length).replace(CODE_LABEL_RE_G, (_, c) => (c.trim() ? `(${c.trim()})` : ''));
  let head;
  if (!code) head = before;
  else if (before && isSameModelCode(before, code)) head = code;
  else head = before ? `${before} (${code})` : `(${code})`;
  return `${head}${after}`.trim();
}
