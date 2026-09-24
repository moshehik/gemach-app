# tools/v3-lint/ — בדיקות מכניות (CONSTITUTION §ח.1)

חמש בדיקות ראשונות מתוך רשימת האכיפה המחייבת בחוקה, ממומשות כסקריפטי Node
עצמאיים (לא תלויות ב-ESLint plugin/stylelint שלא הותקנו — ראו "מה עוד חסר" למטה),
רצות סטטית על טקסט, בלי DB/דפדפן. כל אחת ניתנת להרצה בנפרד או ביחד:

```bash
npm run lint:v3          # כל חמש הבדיקות ברצף
npm run lint:v3-hex       # #1  אין hex/rgb מחוץ ל-tokens
npm run lint:v3-media     # #11 breakpoints רק מהסט הרשמי (480/640/768/1024/1440/1920)
npm run lint:v3-dialogs   # #2  אין alert/confirm/prompt גולמיים (חוץ מ-legacyShim.js)
npm run lint:v3-arrows    # #5  חצים רק דרך <Icon name="...סמנטי...">, לא טקסט/שם גיאומטרי
npm run lint:v3-fontsize  # #4  אין font-size קשיח (רק var(--v3-fs-*) / inherit)
```

## איך זה עובד
כל בדיקה סורקת קבצים תחת `app/v3/**` ו-`app/v3-gallery/**` ומדווחת ממצאים.
**Baseline** (`lint-baseline.json`, CONSTITUTION §ח.1 "הכנסה הדרגתית"): הפרה
שכבר הייתה קיימת לפני שהבדיקה נכתבה **לא מכשילה** את הסקריפט (`exit 0`) —
אבל היא מודפסת בכל הרצה כדי שאי אפשר יהיה לשכוח ממנה, ואסור להוסיף אליה
הפרות חדשות. הפרה **חדשה** (לא ב-baseline) מכשילה את הסקריפט (`exit 1`)
ומדפיסה בדיוק איפה. כל רשומה ב-`lint-baseline.json` חייבת `reason` — ראו
הקובץ עצמו: כל שורה מוסברת (למשל `#000` בתוך CSS `mask` זה לא צבע חזותי;
`←` בפיד ההיסטוריה זה בדיוק המקרה שה-`<Range>` העתידי אמור לטפל בו).

## מה עוד חסר (לא נבנה בסבב הזה — MASTER-PLAN Phase 1.6/4)
- כללים #3 (modal-backdrop ידני), #6 (הכול דרך LayerManager), #7 (`style={{}}`
  ל-tokens), #8 (מאפיינים לוגיים RTL), #9 (z-index רק מסולם), #10 (תנועה רק
  מ-tokens), #12 (מלל/org דרך config, `no-hebrew-literal`), #13 (IconBtn עם
  label), #14 (שלמות tokens + AA), #15 (אין העלמת תוכן), #16 (כיסוי גלריה
  `*.gallery.js`), #19 (תחומי import).
- `stylelint`/`eslint` plugin אמיתיים (כרגע: סקריפטי regex ידניים, לא AST) —
  יותר עמידים, אבל דורשים תלויות build חדשות שלא הוספתי בלי לבדוק שהן לא
  שוברות משהו אחר בפרויקט (`stylelint` לא מותקן היום).
- מחולל הגלריה האוטומטי (`gallery/build.mjs`, LIBRARY-MAP §8) — הגלריה כרגע
  עדיין נכתבת ידנית (`app/v3-gallery/Gallery.js`), לא נסרקת מ-`*.gallery.js`.
  בניית התשתית הזו היא עבודה משמעותית בפני עצמה; הועדפה כאן הרחבת הגלריה
  הידנית הקיימת עם דוגמאות אמיתיות (LayerManager/strings/config) על פני
  בניית מחולל שלם בלי זמן לבדוק אותו.

כל אחד מהחסרים האלה מתועד גם ב-`docs/redesign-v3/WORKLOG.md` וב-`AGENT-QUESTIONS.md`
במקומות הרלוונטיים, לא רק כאן.
