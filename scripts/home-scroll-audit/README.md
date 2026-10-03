# בדיקת גלילה — דף הבית, תצוגת טבלה + "עוד N"

מריץ ב-Chrome headless את הדף האמיתי (`HomeA5`) עם API מדומה של 40 שורות לכל סוג (`entry.jsx`), עובר על החיפוש **הכללי** (`HomeResults`) ועל החיפוש
**המתקדם** (`HomeAdvResults`) ב-1280x800 וב-375x812: עובר לתצוגת טבלה, לוחץ "עוד N", ואז גולל באמת (גלגלת מעל הטבלה / בשוליים / מקש End; במובייל
החלקת אצבע `touchStart/Move/End`). נכשל אם עטיפת הטבלה (`.tblw`) חותכת את הגוף, אם הגלילה לא זזה, או אם השורה האחרונה לא נצבעת/אי אפשר להגיע אליה.

```
ESBUILD_DIR=<תיקיית esbuild> node scripts/home-scroll-audit/build.mjs   # פעם אחת ובכל שינוי בדף / ב-CSS
node scripts/home-scroll-audit/run.mjs [תווית]                           # יוצא 1 אם נכשל; צילומים + JSON ב-out/
```

הבאג שנתפס (4.10.2026): `globals.css` `div:has(> table){max-height:75vh;overflow-y:auto}` תפס את `.gm-ds .tblw`, והפלטה קובעת לו `overflow:hidden` ⇒ גוף הטבלה
נחתך ב-75% מגובה החלון בלי גלילה. התיקון: `.gm-ds .tblw { max-height: none }` ב-`app/globals.css`. שמירה סטטית: `scripts/test_home_css_guard.mjs` (6א).

דרישות: כמו `scripts/home-bg-audit` (Chrome, `puppeteer-core`, `react`, `esbuild`). פורט השרת: `SCROLL_AUDIT_PORT` (ברירת מחדל 5181; לא 3000). אין DB.
