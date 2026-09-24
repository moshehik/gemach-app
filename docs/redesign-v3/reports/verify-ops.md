# verify-ops — ביקורת עצמאית (קריאה בלבד)

ענף: `origin/redesign/site-v3-pages-ops` מול `origin/main` · קבצים: `app/alterations/page.js`, `app/board/page.js`, `app/deliveries/page.js`, `components/ops-v3/{OpsKit.js,ops.css}` · חוזים: alterations.md, board.md, deliveries.md

## פסק דין: ⚠️ תואם עם הערות (אין פערים חוסמים)

לא נמצא אובדן נתונים, אובדן handler, שינוי קריאת רשת/state/effect/תלות, או שינוי בלוגיקת חלון היום (`lib/` לא שונה כלל בענף; `getIsraelDayRange` לא נגעו בו ואינו מופיע בשלושת העמודים). `layout.js` (PageGate) לא שונה.
ההערות למטה הן טקסט/התנהגות-תצוגה בלבד וצריכות בדיקת דפדפן.

## ראיות (סקריפטים; ב-scratchpad)
1. **חתימות רשת/state/effects/מטמון** (`fetch(`, `fetchSharedJson`, `buildBoardMonthParams`, `buildAlterationsListUrl`, `cacheNamespace`, `JSON.stringify`, `method:`, כל `useState/useRef/useMemo/useCallback/useEffect` + מערכי תלות, `router.`, `window.*`), diff ישן↔חדש:
   - board: `IDENTICAL`
   - deliveries: `IDENTICAL`
   - alterations: ההבדל היחיד = הסרת שתי שורות `window.customConfirm` (הוחלפו ב-`ask(...)` — ראו סעיף חלוניות) + הערה.
2. **`diff -w` מלא** של 3 העמודים: כל שינוי מחוץ ל-JSX/מלל הוא רק: `tell()` במקום `alert()`, `ask()` במקום `customConfirm`, `enqueueNotice` (בונוס), `DIRECTION_META` (שדות תצוגה), `getCategoryLabel` (מלל), מחרוזות `emailResult.message`. גופי `handle*/markDone/markAllDone/fetchForExport/getCurrentAlterationOrderIds/printDayOrders/onClick` של כפתור "החל סינון" — זהים.
3. **קומפילציה סטטית:** `@babel/parser` (jsx) על 4 הקבצים — OK. `@babel/traverse`: אין משתנים לא-מוגדרים; יבוא לא-בשימוש (`HebrewDatePicker` ב-alterations, `React` ב-board) — קיימים גם בישן. כל 31 שמות האיקון בשימוש קיימים בספרייט (`IconSprite.js`+`IconSpriteV3.js`, כולל alias). כל הייצוא מ-`@/app/v3/ui/components` בשימוש קיים.
4. **מזהים/data-/id/htmlFor:** נשמר `id="alterationsListPageNum"`; `board-adv-ai-mode` נשמר כ-`id` (עובר דרך `Switch` ל-input); `ai-feature-element` נשמר על עוטף המתג. `htmlFor` נעלם (ה-`<label>` של `Switch` עוטף את הקלט — תקין).

## טבלת חוזה

### /alterations
| פריט | בקוד החדש | זהה? |
|---|---|---|
| GET /api/alterations דרך `buildAlterationsListUrl` (סדר פרמטרים = מפתח מטמון) + SWR + prefetch עמוד הבא 1500ms | alterations.js:~70-108 | ✅ זהה |
| POST /api/alterations/mark-done `{orderItemId}` / `{date}` | ~130-155 | ✅ (סימון פריט: בלי `pending` → map, עם `pending` → filter — זהה) |
| POST /api/ai/smart-search `{prompt,pageContext:'alterations'}` | ~190-205 | ✅ |
| בורר טווח (לא מאפס `page`), חיפוש רגיל/AI, מתג מצב (העברת טקסט בין השדות), נקה, סטטיסטיקה עם x,y | SearchBar (OpsKit) + handlers מהעמוד | ✅ |
| לשוניות הכל/ממתינים/בוצע → `setFilterStatus` בלבד (בלי איפוס page — כמו בישן) | ~379-385 | ✅ (התווית "בוצע"→"בוצעו") |
| "סמן יום כבוצע" disabled בלי `startDate`; חסר תאריך → הודעה + return | ~139 | ✅ |
| ExportButtons: columns, `onFetchData=fetchForExport`, `iconOnly` | ~340-345 | ✅ |
| PrintWizardModal + `getCurrentOrderIds` (limit=2000) | ~519-523 | ✅ |
| מקרא, StatisticsModal (contextQuery=aiQueryUsed) | ~523-550 | ✅ |
| pager: `#alterationsListPageNum`, min/max, `parseInt`, קבלה רק ב-1..totalPages | ~488-510 | ✅ |
| **טבלה 7→6 עמודות** | ראו למטה | ✅ ללא אובדן נתונים |

**השוואת נתוני-שורה ישן→חדש (alterations):**
| נתון | ישן | חדש |
|---|---|---|
| תאריך אירוע (`eventDateHebrew` / `getHebrewDateString` / '-') | עמודה 1 | עמודה "אירוע" (ביטוי זהה) |
| שם לקוח | עמודה 2 | עמודה "לקוח" |
| דגם שמלה (ביטוי שם+קוד/`description`/`dressName`) | עמודה 3 | עמודה "שמלה" — ביטוי זהה תו-בתו |
| מידה (`sizeText \|\| size`) | עמודה נפרדת (badge, גם ריק) | Chip "מידה X" בתוך תא השמלה, רק כשקיים — אין אובדן (הריק לא הציג נתון) |
| צוואר/שרוול/אורך/פירוט + '-' כשאין | עמודה 5 | עמודה "תיקונים" — אותם תנאים ואותו מלל |
| סטטוס בוצע/ממתין | badge | Tag |
| קישור כרטיס הזמנה + כפתור "סמן שבוצע" (מוסתר בבוצע לשימור מיקום) | עמודה 7 | עמודה "פעולות" — זהה |

### /board
| פריט | בקוד החדש | זהה? |
|---|---|---|
| טעינת חודש (`fetchSharedJson`/`buildBoardMonthParams`/`boardCache`) | ללא שינוי (חתימות IDENTICAL) | ✅ |
| ניווט חודש, קפיצה לתאריך (`HebrewDatePicker jumpDate`), אשף הדפסה (`enableBatchPrint...`) | header ~590-600 | ✅ |
| חיפוש רגיל/AI/גלובלי (`handleGlobalSearch`), חיפוש מתקדם | toolbar ~601-620 | ✅ (alert→`tell`, בלי await — ההמשך זהה: return) |
| תא יום: הדגשות today/late/`isHighlighted`, כפתור הרחבה, כפתור הדפסה (`enableBatchPrintPrep`), ספירה, פרשה/חגים, תאריך לועזי | ~500-560 | ✅ |
| כרטיס הזמנה: onClick/hover/popover/תפריט פעולות (הזמנה/לקוח/החזרה-השכרה) | ~350-400, ~896-935 | ✅ (handlers ללא שינוי) |
| מקרא קטגוריות (מותנה `enableAlterations`) | ~622-630 | ✅ |
| חלונית חיפוש מתקדם: 7 שדות + לשוניות basic/details + מתג AI + "החל סינון"/"נקה הכל" | ~700-765 | ✅ כל שדה מקושר ל-`advFilters` ול-`setAdvFilters` |
| חלונית תוצאות גלובליות (loading/ריק/רשימה, "מעבר לחודש", "פתיחת ההזמנה" target=_blank) | ~767-830 | ✅ |
| חלונית "הזמנות ליום": סינון `dayOrdersFilter`, הדפסה, סגירה מאפסת סינון | ~832-890 | ✅ |
| **quirk: תווית "לקוח" ריקה בפופאובר** | board.js:649 (`ops-kv__l` בלי ערך) | ✅ נשמר (רק הנקודתיים ירדו) |
| **quirk: `highlightedDate` מת** | board.js:85 (state), 455, 504 (`ops-day--hl`) | ✅ נשמר (עדיין לא מקבל setter בשימוש) |

### /deliveries
| פריט | בקוד החדש | זהה? |
|---|---|---|
| שליפות/טווחי תאריך/`byEventDate`/`rangeMode`/פילוח ערים — לוגיקה | חתימות IDENTICAL | ✅ |
| ניווט יום קודם/היום/הבא, בורר תאריך, חיפוש חופשי (+נקה), לשוניות כיוון, לשוניות טווח | ~300-340 | ✅ |
| שליחה במייל: POST + `emailResult`, `submitPrintModal`, `openPrintModal('courier-print')` | ללא שינוי בגוף | ✅ (רק מלל הודעות) |
| ייצוא: `directionsLabel`/`chargeStatusLabel` משתמשים ב-`DIRECTION_META[d].label` | 245-248 | ✅ label נשמר במפורש ("לייצוא") |
| **טבלה 7→5 עמודות** | ראו למטה | ✅ ללא אובדן נתונים |

**השוואת נתוני-שורה ישן→חדש (deliveries):**
| נתון | ישן | חדש |
|---|---|---|
| שם לקוח, טלפון 1, טלפון 2 | עמודה 1 | עמודה "לקוח" (זהים, תנאי `&&` זהים) |
| מס' הזמנה + קישור `/orders/{id}` | עמודה 2 | בתוך עמודת "לקוח" ("הזמנה #id", אותו href) |
| כתובת / '-' | עמודה 3 | עמודה "כתובת" |
| דגמים (`join(', ')`) / '-' | עמודה 4 | עמודה "דגמים" |
| תאריך אירוע עברי / '-' | עמודה 5 | עמודה "אירוע" |
| כיוון הלוך/חזור (`visibleDirections`) + `formatDispatchHint(dispatchDates)` | עמודה 6 | עמודה "משלוח": Tag ("הלוך"/"חזור") + אותו hint |
| חיוב לכל כיוון (`chargeExists[d]`: נוצר / טרם נוצר) | עמודה 7 (רשימה נפרדת) | באותה עמודה לצד כל כיוון (Chip "חיוב נוצר" / "עדיין בלי חיוב") — מקושר ישירות לכיוון, יותר ברור. אותה קבוצת כיוונים |

**נתיבי סגירה של חלונית ההדפסה ב-deliveries (ה-X הוסר):**
- כפתור "ביטול" → `setShowPrintModal(false)`, disabled בזמן `emailSending` ✅ (ישן: אותו תנאי על ה-X)
- Esc → `closePrintModal` (חסום בזמן `emailSending`) ✅ (חדש; לא היה בישן)
- לחיצה על הרקע → `closeOnScrim={!emailSending}` ✅ (זהה לישן)
- אחרי הדפסה/שליחה מוצלחת: ללא שינוי בגוף `submitPrintModal`.
מסקנה: כל נתיבי הסגירה הקודמים קיימים, ונוסף Esc. אין נתיב תקוע.

### חלוניות/אישורים
- `useOpsDialogs.ask()` → `Promise<boolean>`: אישור=true; ביטול/Esc/רקע=false; פתיחת חלונית שנייה מבטלת את הראשונה (false). `markDone`/`markAllDone` נשארים `if (!(await ask(...))) return;` — אותו זרם. `tell()` (במקום `alert`) לא חוסם את ה-thread, אבל בכל מקום `return` בא מיד אחרי — אין תלות בחסימה.
- ✅ `markAllDone` ללא תאריך: `tell` ואז return (כמו alert+return).

## פערים חוסמים
אין.

## הערות לא חוסמות
1. **נוסח שונה (תצוגה בלבד):** תוויות קטגוריה ב-board (`getCategoryLabel`): "הזמנה פגומה (0 פריטים)"→"הזמנה ריקה", "מושכר/חלקית"→"בהשכרה", "הושלם (שולם)"→"שולמה במלואה" וכו'. נבדק: אינן משמשות להשוואה/שליחה/ייצוא (רק title/Chip/popover). "חלקית" עברה ל-Tip של המקרא. כותרות עמודות/כפתורים שונו (למשל "הדפסת משלוחים"→"הדפסה ושליחה", "בוצע"→"בוצעו" בלשונית).
2. **alterations:** הקוד קורא לצבעים במקרא "פס אפרסק/פס כחול" — תלוי ב-`--v3-pending-bg/line` וב-`--v3-navy` ב-`ops.css:39-42`; יש לאשר ויזואלית שהתיאור תואם. שורת ה-hover קבועה לצבע הרקע (כמו בישן).
3. **deliveries:** הערת "מוצגים משלוחים להזמנות שתאריך האירוע…" הפכה מטקסט גלוי ל-`Tip` (ריחוף) — המידע נשמר אך פחות בולט.
4. **board:** מקרא הפופאובר "מצב" (ולא "סטטוס"); הספרה/`₪` עטופים ב-`<bdi>` (RTL תקין). פופאובר: `ops-pop` חייב `position:fixed` + `translate(-50%,-100%)` — קיים ב-ops.css:99. תפריט פעולות `ops-menu` `position:absolute` כמו בישן (אותו חישוב `actionPos`).
5. **RTL/עיצוב:** לא נמצאו `left/right` קשיחים בעמודים (רק `top/left` דינמיים למיקום פופאובר/תפריט — כמו בישן, וזה נכון כי הם קואורדינטות viewport). אין `alert()` שנותרו בעמודים. כל האיקונים דרך `<Icon>`. נותרו `style={{...}}` מעטים ל-tooltip/אנימציה? — לא; הכל דרך מחלקות `ops-*`.
6. `app/version.json` שונה בענף (bump גרסה) — מחוץ לתחום העמודים, לידיעה.
7. `Dialog variant="form"` חוסם `mode=dark` (תמיד בהיר) — מתועד בקוד; לחלוניות עם שדות (חיפוש מתקדם, הזמנות ליום, הדפסה ושליחה) זה מכוון.

## מה לא נבדק סטטית (דורש דפדפן)
- מיקום/z-index של פופאפ `HebrewDatePicker`/`HebrewDateRangePicker` בתוך `Dialog` (חיפוש מתקדם, נתוני שקית, טווח הדפסה) — האם נפתח מעל ה-scrim.
- מיקום פופאובר הרחפה ותפריט הפעולות ב-board בגלילה, וגם ב-RTL (`left` דינמי).
- לכידת פוקוס ב-Dialog מקונן מעל `StatisticsModal`/`PrintWizardModal` (רכיבים ישנים עם סגנון ישן).
- צבע/ניגודיות של פס-שורה ב-alterations (ממתין/בוצע) ושל אפקט "יום באיחור" ב-board.
- מובייל: טבלאות 6/5 עמודות (גלילה אופקית ב-`v3-table__wrap`).
- `enqueueNotice` (התראת הצלחה) — נעטף ב-try/catch; לא נבדק שהיא מוצגת בפועל.
