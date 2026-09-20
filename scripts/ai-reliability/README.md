# בדיקות אמינות לסוכני ה-AI (2026-09-20)

מערך בדיקות **לקריאה בלבד** שמריץ את נתיבי ה-AI האמיתיים של האתר (הפרומפטים והקוד האמיתיים,
לא העתק) מחוץ ל-Next.js, מול מסד אמיתי, ומשווה את התשובות לאמת מהמסד. הרקע, הממצאים והתיקונים:
[docs/ai-agents-reliability-2026-09-20.md](../../docs/ai-agents-reliability-2026-09-20.md).

## מה בפנים
| קובץ | תפקיד |
|---|---|
| `unit/aiCommon.basic.mjs`, `unit/aiCommon.hints.mjs` | בדיקות יחידה ל-`lib/ai/aiCommon.js` (72 בדיקות, בלי רשת ובלי מסד) |
| `suites/core.mjs` | 43 שאלות על 6 הסוכנים |
| `suites/replay.mjs` | 35 שאלות אמיתיות מההיסטוריה, כולל הודעות אי-שביעות רצון ("לא נכון", "איפה הרשימה?") |
| `run.mjs` | מריץ סוויטה ושומר תוצאות ל-`scratch/ai-reliability-out/` |
| `shims/prisma.mjs` | לקוח Prisma "לקריאה בלבד": SELECT עובר, כל כתיבה נחסמת ומדווחת |
| `shims/*`, `hooks.mjs`, `register.mjs` | מחליפים `next/server`, `next/headers`, `lib/auth`, `fs` (כדי ש-`ai-log.txt` לא ישתנה) |

## הרצה
מתוך `gemach-app/`:

```bash
# בדיקות יחידה
node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/unit/aiCommon.basic.mjs
node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/unit/aiCommon.hints.mjs

# סוויטה מול מסד (מפתחות Gemini נקראים מ-.env.local; העלות: כ-2-3 קריאות ל-Gemini לשאלה)
EXPERIMENT_DB_URL="<כתובת Postgres>" node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/run.mjs core
EXPERIMENT_DB_URL="<כתובת Postgres>" node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/run.mjs replay
```

לגמח נווה יעקב `EXPERIMENT_DB_URL` הוא `PROD_DATABASE_URL` מתוך `scratch/new_gemach_db.env`
(**חשוב:** הכתובת משתנה בכל cutover של Neon - קראו אותה מחדש ואל תעתיקו ממקום אחר).

לגמח הראשי `EXPERIMENT_DB_URL` הוא `DATABASE_URL` מתוך `.env` (`gemach-main-prod`, `ep-weathered-tree-...`; נבדק ב-2026-09-20).
`OUT=<שם>` שומר את התוצאות בקובץ נפרד, ופרמטר שלישי (`run.mjs core "טקסט מהשאלה"`) מריץ רק שאלות שמכילות אותו.
שימו לב: הריצה דורשת גם `PROJ` (שורש הפרויקט) ו-`SPDIR` (`scripts/ai-reliability`) כמשתני סביבה.

## מגבלות שחשוב להכיר
- ערכי ה-`truthSql` ו"האמת" (למשל 334 הזמנות באלול תשפ"ו, 22 משפחות בדגם 811) הם **נתוני נווה יעקב נכון
  ל-2026-09-20**. הם נכונים כל עוד הנתונים ההיסטוריים לא משתנים; שאלות שתלויות ב"היום" (למשל "כמה הזמנות
  יש למחר") צריכות עדכון תאריכים לפני שמשווים.
- ה-AI אינו דטרמיניסטי: הרצה חוזרת תיתן ניסוחים שונים. בודקים את **העובדות** (מספרים, תאריכים), לא את הנוסח.
- שרת הפיתוח המלא ומסכי ה-UI (למשל הטבלה ב-`StatisticsModal`) **לא** נבדקים כאן.
- ניתוח צילום מסך והקלטת מסך בצ'אט לא נבדקים (דורשים מדיה).
- אין כאן CI: זו בדיקה שמריצים ידנית אחרי שינוי בפרומפט או ב-`lib/ai/aiCommon.js`.
