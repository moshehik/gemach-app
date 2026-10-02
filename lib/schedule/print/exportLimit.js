// מגבלת השורות לייצוא Excel של הדפסות הלו״ז (החלטת הבעלים D6), נאכפת ב-POST/GET /api/schedule/print format=rows.
// ברירת מחדל כשלעובד אין ערך - אותה ברירת מחדל כמו components/ExportButtons.js לפני טעינת /api/me.
export const DEFAULT_EXPORT_LIMIT = 200;

// feature:export_max_rows -> מספר. 0 הוא ערך אמיתי ("כל ייצוא דורש אישור", כמו ב-ExportButtons) ונשאר 0;
// ברירת המחדל רק כשאין ערך (null / undefined / מחרוזת ריקה) או כשהערך אינו מספר אי-שלילי.
export function parseExportLimit(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return DEFAULT_EXPORT_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_EXPORT_LIMIT;
}
