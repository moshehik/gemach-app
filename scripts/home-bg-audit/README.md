# בדיקת רקעים מול העיצוב — דף הבית (`HomeA5`)

מריץ ב-Chrome headless את **הדף האמיתי** (`HomeA5.js` + `home.css` + כל קבצי ה-CSS הגלובליים של האתר: `globals.css`, `design-overrides.css`,
`design-system.css`, `components.css`) מול **העיצוב המאושר** (`דף-הבית.html`), עובר על כל שלבי החיפוש, ומשווה צבע רקע / תמונת רקע / טשטוש / צבע טקסט /
גבול / צל / רדיוס לכל אלמנט באזור החיפוש. מדפיס רק הבדלים. כך אפשר לבדוק בפקודה אחת אחרי כל מיזוג של דף או שינוי CSS שלא נוצרה דליפה.

```
node scripts/home-bg-audit/run.mjs            # 1280px, ערכת נושא בהירה
node scripts/home-bg-audit/run.mjs 390        # מובייל
node scripts/home-bg-audit/run.mjs 1280 dark  # data-theme=dark
```

פלט: `scripts/home-bg-audit/out/` (צילומי מסך `real-*.png` / `demo-*.png` לכל שלב + JSON). `TOTAL 0` = אין הבדלים.

## דרישות
- Chrome מותקן (ברירת מחדל `C:/Program Files/Google/Chrome/Application/chrome.exe`, אחרת `CHROME_PATH=...`).
- `puppeteer-core` ו-`react` מ-`node_modules` של הפרויקט (`npm install`), ו-`esbuild` (לא תלות של הפרויקט: `npm i --no-save esbuild`, או `ESBUILD_DIR=<נתיב>`).
- קובץ העיצוב: `DEMO_HTML=file:///...` (ברירת מחדל: תיקיית "תצוגות-עיצוב/סיימתי-לעבוד" בשולחן העבודה של הבעלים).
- פורט השרת הסטטי: `AUDIT_PORT` (ברירת מחדל 5179). **לא** פורט 3000 — זה שרת הפיתוח המשותף. אין חיבור ל-DB: ה-API מדומה ב-`entry.jsx`.

## מה נבדק (שלבים)
פתיחה (רגיל / hover על הכדור / פוקוס / עם טקסט), מצב חיפוש חכם, בורר תחומים של המתקדם (hover, "עוד"), טופס מתקדם (פוקוס, הצעות, דגל מסומן,
בורר תאריך עברי), תוצאות (פוקוס, hover, שורה, תצוגת טבלה), שיחת AI (שדה המשך, טבלה), תוצאות מתקדם, טעינה (שדה מנוטרל), אין תוצאות, כרטיס שגיאה.
בסוף: סדר פריטי שורת החיפוש מימין לשמאל (RTL) מול העיצוב.

## הבדלים מוכרים שאינם באגים
- אזורי הדמו עצמו (לוח הבקרה העליון, `pv-*` כרטיסי "קישורים מהירים", `site-foot` של הדמו) מסוננים ב-`cmp.mjs` (`skip`).
- שורות "(real-only element)" = אלמנט שבדף האמיתי הוא `div.li` והדמו `a.li` (אותו רקע, מזהה שונה).
- מצבי hover תלויי מיקום עכבר (`opacity`, `box-shadow` של `.advplus.open` באמצע אנימציה) יכולים להבהב.
- בדמו הפוקוס עובר אוטומטית לשדה הראשון בטופס המתקדם; בדף האמיתי לא — לכן `bs` של `input.inp` בשלב `07` שונה.

## קבצים
`run.mjs` (הרצה), `build.mjs` (esbuild של הדף האמיתי), `entry.jsx` (טעינת `HomeA5` עם fetch מדומה), `stages.mjs` (שלבים + dump של ה-computed style),
`cmp.mjs` (השוואה), `lib.mjs` (שרת + Chrome), `stubs.js`/`sqp.js` (תחליפי next/navigation ו-SettingQuickPanel). שמירה סטטית בלי דפדפן: `scripts/test_home_css_guard.mjs`.
