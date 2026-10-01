// מיון מידות: sizeText הוא טקסט ב-DB, ולכן מיון רגיל נותן "10" לפני "2".
// כאן ממיינים לפי הערך המספרי שבתחילת המידה (גם "38-40" נופל על 38),
// ומידות בלי מספר (למשל "כללי") נדחפות לסוף לפי א"ב.
export function compareSizeText(a, b) {
  const aStr = String(a ?? '');
  const bStr = String(b ?? '');
  const aNum = parseFloat(aStr);
  const bNum = parseFloat(bStr);
  const aIsNum = !isNaN(aNum);
  const bIsNum = !isNaN(bNum);
  if (aIsNum && bIsNum) return (aNum - bNum) || aStr.localeCompare(bStr, 'he');
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return aStr.localeCompare(bStr, 'he');
}

// מפתח השוואה למידה (בדיקת מלאי, lib/stockCheck.js + lib/stockCheckUi.js): רווחים נחתכים; מספר שלם עד 3 ספרות
// בלי אפסים מובילים ("06" ≡ "6" ≡ " 06", "00" ≡ "0"); ריק = "כללי"; כל טקסט אחר ("06.1", "36א", "38-40") כפי שהוא.
// רקע: ב-DB המידות נשמרות כטקסט מהייבוא (בגמ"ח הראשי תמיד בשתי ספרות, בנווה יעקב מעורב). מודול טהור, בלי imports.
export const GENERAL_SIZE_KEY = 'כללי';
export function normalizeSizeKey(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return GENERAL_SIZE_KEY;
  if (/^\d{1,3}$/.test(t)) return String(parseInt(t, 10));
  return t;
}

// ממיין רשימת שורות זמינות ({ sizeText / size }) בלי לשנות את המערך המקורי.
export function sortSizeRows(rows) {
  return [...rows].sort((a, b) => compareSizeText(a.sizeText || a.size, b.sizeText || b.size));
}
