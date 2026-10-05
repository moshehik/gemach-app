# בדיקת נאמנות + זרימות - חלון "דיווח על שגיאות"

מריץ ב-Chrome headless את **החלון האמיתי** (`ErrorReportButton` → `ErrorReportWindow` + `errorReport.css` + `launcher.css` + כל ה-CSS הגלובלי
של האתר: `globals.css`, `design-overrides.css`, `design-system.css`, `components.css`) על דף מדומה עם API מדומה (`entry.jsx`, בלי DB ובלי שרת
פיתוח), מול **הסקיצה המאושרת** `תצוגות-עיצוב/דיווח-שגיאות-סקיצות-2.html`, ב-22 מצבים, ומשווה לכל אלמנט רקע / תמונת רקע / טשטוש / צבע /
גבול / צל / רדיוס / שקיפות / גופן / ריפוד, ואת מרחק ה-X מהקצה הימני.

```
ESBUILD_DIR=<נתיב ל-node_modules/esbuild> node scripts/error-report-audit/run.mjs 1280
ESBUILD_DIR=... node scripts/error-report-audit/run.mjs 375
node scripts/error-report-audit/interact.mjs      # זרימות אמיתיות (אחרי build.mjs)
```

פלט: `scripts/error-report-audit/out/` (או `ER_AUDIT_OUT`): צילומי `demo-<רוחב>-<מצב>.png` / `real-<רוחב>-<מצב>.png`, JSON, `cmp-<רוחב>.txt`.
`TOTAL 0` = אין הבדל שאינו מכוון. `EXPECTED` = הבדלים מכוונים, לפי סיבה (`SHOW_EXPECTED=1 node cmp.mjs 1280` מציג אותם).

## מצבים
01 ריק · 02 מלא (טקסט + אלמנט + PDF + הקלטת פעולות) · 03 אלמנט סומן · 04 מצב סימון · 05 הקלטת פעולות · 06 שגיאת תיקוף · 07 שולח · 08 שגיאת
תקשורת · 09 אחרי שליחה · 10 רשימה · 11 פניות רבות (24, חיפוש) · 12 ריקה · 13 ארכיון · 14 שרשור · 15 שרשור ארוך · 16 סקיצה ממתינה · 17 מענה
אנושי · 18 אין הרשאה · 19 מתכנת · 20 תצוגה גדולה של צרופה · 21 ריחוף על אייקוני הטופס · 22 ריחוף על אייקוני התגובה.

## הבדלים מכוונים (`EXPECTED` ב-`cmp.mjs`)
- הוראות הבעלים 4.10.2026: שמות בזהב; כפתורים עגולים כחולים (`.tools .xlbtn.xlp`) במקום תפריט ⋯ (תפריט הסקיצה מסונן); "מענה אנושי" בגוף
  השיחה; הצעדים שהוקלטו לא מוצגים למדווח (בטופס רק "נרשמו N צעדים" + הסר).
- צילומים אמיתיים (`img`) במקום הציורים הסכמטיים של הדמו (`.er-shot`, `.er-ei`, `.er-lbshot`).
- טוסט ואנימציות: רגע אחר בזמן הצילום.

## קבצים
`run.mjs` · `build.mjs` (esbuild; `next/dynamic` מוחלף ב-`dynamic-stub.js`) · `entry.jsx` (דף + API מדומה; פרמטרים `shell/role/data/rec/post/bottom/human`) ·
`index.html` · `stages.mjs` · `cmp.mjs` · `interact.mjs` · `lib.mjs` (שרת סטטי על פורט 5187 - **לא** 3000 - ו-Chrome) · `mock/` (קבצי צרופה וסקיצה לדוגמה) ·
`probe-sketch.mjs` (מיקום אייקון הדיווח בסקיצה) · `smoke.mjs`.
