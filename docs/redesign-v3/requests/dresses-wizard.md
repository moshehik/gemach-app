# בקשות — dresses wizard / inactive modal / pricelist

## REQ-1 · app/dashboard/pricelist/page.js · רכיב טבלה · נמוכה
**מה:** אין ב-`Table` תמיכה בשורת עריכה בתוך הטבלה (inline edit) ולכן נעשה שימוש ישיר ב-`v3-table__wrap` / `v3-table` / `th` / `td`.
**איפה:** `renderEditRow` בעמוד המחירון.
**איך לתקן:** prop `renderRow(row, defaultRow)` או `editingKey` ב-`Table` שמחליף שורה ברכיב מותאם.
**סטטוס:** פתוח (עוקף כרגע בסימון ידני, אותן מחלקות).

## REQ-2 · app/dashboard/pricelist/page.js · טוקן רוחב · נמוכה
**מה:** אין טוקן לרוחב שדה מספר צר בטבלה; נעשה שימוש ב-`calc(var(--v3-tap) * 2)`.
**איך לתקן:** מחלקה `.v3-input--num` (inline-size קבוע מטוקן).
**סטטוס:** פתוח.

## REQ-3 · components/dresses/modern/ModernNewDressWizard.js · אזור תצוגה מקדימה · נמוכה
**מה:** אין מחלקה לתיבת תצוגה מקדימה של תמונה (מסגרת + רקע + contain); הוגדר inline עם טוקנים.
**איך לתקן:** `.v3-preview` ב-components.css.
**סטטוס:** פתוח.
