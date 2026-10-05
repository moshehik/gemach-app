# נאמנות לעיצוב — כרטיס הלקוח החדש (A5)

עיצוב מאושר: `תצוגות-עיצוב/כרטיס-לקוח.html` + תשובות הבעלים 4.10.2026 (`scratch/customer-card-build/answers-customercard.json`).
קוד: `app/components/customer-card/*`, CSS: `customer-card.css` (בהיקף `.gm-ds.gm-cc`). מאחורי הדגל `ui_variant_customer_card` (ברירת מחדל `legacy`).

## בדיקה
```
ESBUILD_DIR=<נתיב ל-esbuild> node scripts/customer-card-audit/run.mjs 1280   # או 375
node scripts/customer-card-tests/run.mjs                                     # logic + parity + static
node scripts/test_home_css_guard.mjs                                         # סעיף 11 = כרטיס הלקוח
```
האודיט בונה את הכרטיס האמיתי עם API מדומה (`entry.jsx`, הלקוחה של העיצוב) ומשווה computed style (רקע, צבע, גבול, צל, רדיוס, גופן,
ריפוד, שוליים, רוחב, גובה) מול העיצוב ב-23 מצבים (פרטים, עריכה, מסילה עם שינוי + טוסט, כרטיסי ריחוף, סיכום, הצלחה, ביטול, יציאה,
הזמנות רשימה/פתוחה/טבלה, תשלומים, חלון תשלום, היסטוריה/סינון/טבלה, תפריט הדפסה, מחיקה, מייל, אישור מנהל) + בדף האמיתי בלבד: חסומה,
לקוח חדש, טעינה, לא נמצא. שכבת הסקירה של העיצוב (`.rvb`, `.rv-e`, `#rv-css`, QPanel) מוסרת לפני הצילום.

## דליפות שנמצאו ונוטרלו (CSS גלובלי ישן → בתוך `.gm-ds.gm-cc`)
| מקור | דליפה | נטרול |
|---|---|---|
| `design-system.css` | `.tab{margin-inline-end:22px}` — הלשוניות 160px במקום 181 | `.tabs .tab{margin-inline-end:0}` |
| `design-system.css` | `.tabs{border-bottom:1px;margin-bottom:18px}` | `.tabs{margin:0;border-bottom:0}` |
| `design-system.css` | `.field{margin-bottom:14px}`, `.topbar` sticky/רקע, `.main{order:1;display:flex}` | כמו בכרטיס ההזמנה/פרופיל |
| `globals.css` | `*{padding:0;margin:0}` מוחק ריפוד דפדפן ללחצנים/שדות שהפלטה לא מגדירה (ביטול שינוי, ניקוי חיפוש, תצוגה מקדימה) | `:where(.gm-ds.gm-cc) :where(button){padding:1px 6px}` (ספציפיות 0) |
| `design-overrides.css` | `input:not(...)` רקע לבן/מסגרת/רדיוס 10 בשדות שקופים (חיפוש ההיסטוריה, סכום התשלום) | `:is(.hf-s,.amtin) input:not(...)` |
| `design-overrides.css` | גופן Assistant/Frank Ruhl ב-!important | `font-family:inherit!important` |
| פלטה | כללי DLG-MODERN עם `:not(.q1)` / `:not(.z1)` הושמטו בסריקה → "חזרה"/"ביטול" בחלון כהה יצאו בכחול, לחצן מנוטרל נראה פעיל | הועתקו לסוף `customer-card.css` |

## הבדלים מוכרים שאינם באגים
- תוכן שונה מהדגימה לפי החלטות הבעלים: שם פרטי/משפחה ורחוב/מספר בית במקום שדה יחיד, כרטיס פרטי בנק, בלי "פרטים מתקדמים", בלי
  "הזמנה חדשה", בלי מתג "פעילות בלבד", בלי שורת "אפשרויות מנהל", בחלון ההצלחה "המשך לצפות" הוא הראשי.
- מצבי ריחוף שנשארים אחרי לחיצה (העכבר נשאר על הלחצן בדף האמיתי; בעיצוב הדף גולל) — `xlbtn.xlp`, כפתורי חלון ההצלחה.
- חלון התשלום: המיקוד על שדה הסכום (בעיצוב בלי מיקוד) → טבעת זהב על `.amtin`.
- 375px: הכותרת "לקוח מרים אברמוביץ" + 4 כלים יושבים בדיוק על גבול 343px — בדף האמיתי הכלים יורדים לשורה שנייה (הפרש של פחות מפיקסל ברוחב
  המילה הארוכה). אותו CSS בדיוק.
- `RT` (כרטיס הריחוף) כשהוא לא פעיל: בעיצוב נשאר `gold` מהריחוף הקודם.
