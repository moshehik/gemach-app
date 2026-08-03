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

// ממיין רשימת שורות זמינות ({ sizeText / size }) בלי לשנות את המערך המקורי.
export function sortSizeRows(rows) {
  return [...rows].sort((a, b) => compareSizeText(a.sizeText || a.size, b.sizeText || b.size));
}
