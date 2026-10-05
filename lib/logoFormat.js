// תצוגה בלבד (בטוח לייבוא בקליינט - בלי sharp). ר' lib/logoCompress.js לדחיסה עצמה.

/** "2.4MB" / "38KB" - לתצוגה בלבד */
export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

/** שורת סיכום בעברית לתצוגה למנהל אחרי העלאה: "הלוגו כווץ: 2.4MB ← 38KB (512×300)". */
export function describeLogoResult(r) {
  if (!r || !Number.isFinite(r.originalBytes) || !Number.isFinite(r.storedBytes)) return '';
  const dims = r.width && r.height ? ` (${r.width}×${r.height})` : '';
  return `הלוגו כווץ אוטומטית: ${formatBytes(r.originalBytes)} ← ${formatBytes(r.storedBytes)}${dims}`;
}
