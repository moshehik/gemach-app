# יומן אינטגרציה 2026-10-12 (שלב א')

ענף: `integrate/2026-10-12`, מעל `origin/main` = `9a56d6ab` (כולל #273-#276).
כלל פתרון קונפליקטים: משמרים את כל הפיצ'רים של שני הצדדים; כשההתנהגות חופפת, הקוד שכבר ב-`origin/main` מנצח והפיצ'ר של הענף מותאם עליו מחדש.
קונפליקטי גרסה (`app/version.json`, `package.json`): תמיד צד `integrate` (HEAD) — הרכז מטפל בגרסה בסוף.

## סדר המיזוגים

| # | ענף | קומיט מיזוג | קונפליקטים |
|---|---|---|---|
| 1 | `fix/settings-api-public-allowlist-2026-10-12` | 1a7fb630 | גרסה בלבד |
| 2 | `fix/stock-check-whole-sizes-2026-10-12` | 8520c22b | גרסה בלבד |
| 3 | `docs/sizes-access-audit-2026-10-12` | 76ce98c8 | גרסה בלבד |
| 4 | `feature/neve-model-numbers-2026-10-12` | 9d3b284d | גרסה בלבד (מיזוג אוטומטי נקי בחפיפות עם #274/#276: ראו פירוט) |

## פירוט והחלטות

### 4. neve-model-numbers
- חפיפה עם `origin/main` בקבצים: `items/[itemId]/route.js`, `items/route.js`, `newOrderLogic.js`, `orderCardLogic.js`, `pricingEngine.js` — כולם נמזגו אוטומטית נקי (השינויים של הענף נקודתיים: שימוש ב-`modelDisplayName`/`scrubPlaceholderInText`, מפתח `useModelNames` ב-`pricingEngine`).
- patches 01/02/04 ב-`docs/model-numbers-integration/` יוחלו בשלב ב'; patch 03 (kiosk) אחרי מיזוג ענף 9.
