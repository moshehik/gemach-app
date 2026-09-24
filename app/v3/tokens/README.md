# app/v3/tokens/ — מקור האמת היחיד לערכי עיצוב v3

פוצל מ-`app/v3/tokens.css` הישן (עדיין קיים כקובץ דק שמייבא את כל אלה, לשמירת
תאימות לכל מי שעדיין מייבא `../tokens.css` ישירות). **שום ערך לא שונה בפיצול
עצמו** — רק ארגון-מחדש לקבצים לפי `LIBRARY-MAP.md §1`. תוספות אמיתיות (טוקנים
חדשים) מסומנות מפורשות בכל קובץ ובקומיט.

| קובץ | תוכן | מי צורך |
|---|---|---|
| `primitives.css` | L0 — רמפות צבע גולמיות (navy/sky/gold/rose/plum/peri) | רק L1/L2, לא עמודים/רכיבים ישירות |
| `semantic.css` | L1 — ~40 המשתנים הסמנטיים, **בהיר בלבד** (D-1) | עמודים ורכיבים — זה מה שצריך לצטט |
| `scale.css` | טיפוגרפיה, מרווח, רדיוס, מסגרות, צללים, תנועה, גדלים, z-index הישן (`--v3-z-*`) + z-scale חדש ל-LayerManager (`--v3-lz-*`) | עמודים/רכיבים; `--v3-lz-*` רק `app/v3/overlays/**` |
| `overlay.dark.css` | `--v3-dlg-*` (הישן, `ui/Dialog.js`) + `--v3-ov-*` (חדש, `overlays/**`) — הכהה היחיד באתר | חלוניות confirm/code/PIN בלבד |
| `base.css` | תיקוני F2/F3 (רקע html/body, גופן), גלילה, dvh/safe-area, מיקוד נראה | `V3Page` בלבד |
| `breakpoints.js` | סט breakpoints יחיד (480/640/768/1024/1440/1920, D-15) + מיפוי מהישן | JS/React בלבד (CSS לא תומך ב-var בתוך `@media`) |
| `contrast.js` | מחשבון ניגודיות AA + רשימת הזוגות הנבדקים | `app/v3-gallery` (דף tokens) |
| `legacy-bridge.css` | גשר `--primary*`/`--bg-color`/... הישנים → L1, **לא מיובא כרגע** (ראו AGENT-QUESTIONS Q-4) | אף אחד עדיין — ממתין להחלטת אדם |

## למה תוקן ולמה לא
- **F1** (`[data-v3] button{font:inherit}` דורס מחלקות בודדות) תוקן ב-`components.css`
  עצמו (`:where([data-v3]) button...`), לא כאן — זו לא בעיית tokens.
- **`@layer`** (בידוד מלא מה-CSS הישן) **לא** הופעל בשלב הזה: קובץ לא-מסודר-בשכבות
  תמיד מנצח קובץ מסודר-בשכבות ב-CSS, אז הוספת `@layer v3` בלי גם לעטוף את כל
  ה-CSS הישן (`globals.css`/`design-system.css`/`design-overrides.css`) הייתה
  **הופכת** את סדר הקדימות לרעה יותר. זה שינוי גדול שחייב אימות בדפדפן אמיתי
  שלא היה זמין במפגש הזה — נשאר לשלב מאוחר יותר, מתועד ב-AGENT-QUESTIONS.

## מה נשאר לא-מפוצל
`icons.css`, `components.css`, `history/history.css`, `notify/notify.css` נשארים
במקומם — הם רכיבים (L2/CSS רכיבים), לא tokens, לפי החלוקה ב-`LIBRARY-MAP.md §1`.
