# דוח בנייה — ordernew (`/orders/new`)

ענף: `redesign/site-v3-pages-ordernew` (מבוסס `redesign/site-v3-2026-09-24`).
קבצים ששונו: `app/orders/new/page.js`, `components/orders/new/NewOrderShell.js` (בשימוש רק בעמוד זה). בקשות: `requests/ordernew.md`.
לא נגעתי ב-`app/api`, `lib`, `prisma`, `app/v3`, ולא ברכיבים המשותפים (ר' REQ-1).

## רשימת בדיקה מול `contracts/orders-new.md`
| נושא | מצב |
|---|---|
| state, effects, refs, טיוטה אוטומטית (1500ms, תור סדרתי, seal), preload/calculate/pricing/validate-inventory/reserve/nedarim/verify-pin/POST orders — URL, method, מפתחות גוף, סדר | זהה (לא נגעתי בגוף הפונקציות; רק ה-JSX + הטקסטים) |
| `gemach_last_order_branch`, `capacity_search_history`, `gemachOrderGuard` | זהה |
| ids: `cust-*`, `order-notes`, `order-notes-step3`, `item-model`, `item-repairs`, `pay-amount`, `pay-method`, `cc-*`, `delivery-city`, `credit-charge-form` (+`form=`) | נשמרו |
| `autoComplete="new-password"`, `autoFocus` בטלפון, קלט swipe נסתר (`autoFocus`+`onBlur`) | נשמרו |
| `<form onSubmit>` בשלב 5 ("הוספת תשלום" = submit; "חיוב באשראי" = button בתוכו) | נשמר |
| שער שלבים `canNavigateToStep`, disabled בכפתורי "המשך" (אותם תנאים) | זהה |
| `key={step}` על גוף השלב | נשמר (ב-NewOrderShell) |
| `isWeekdayEvent` ו-`creditProcessedConfirmation` (קוד מת) | נשמרו כפי שהם |
| כפתור חיוב אשראי בשלב 5 עוקף בדיקת תאריך עבר; חיוב מלא שומר ישירות | נשמר |
| `getCustomerFullName` עדיין מיוצא מ-`page.js` | נשמר |
| `window.customConfirm` / `customAuthPrompt` / `verifyPin` | נשארו (globals של PopupProvider); שונה רק נוסח ההודעות |
| `pendingSpacingChange !== null` (null מול 0) | נשמר; ערכי ה-Seg הם מחרוזות `'null'|'0'..` ומומרים חזרה |
| Enter מעביר שדה בטופס לקוח חדש | נשמר (אין `Tip`/כפתורים חדשים בתוך המכולה מלבד אלה שהיו) |

## מה השתנה
- **סטפר**: `Stepper` של הקיט (צמתים, "שלב X מתוך N", פס התקדמות). צומת נעול = ⓘ עם הסיבה במקום `alert`. פוטר ניווט דביק: המשך (ראשי) / חזרה בתוויות מפורשות ("חזרה ללקוח"...). כפתור המשך חסום מציג ⓘ עם הסיבה.
- **סיכום**: כרטיס לכל בלוק (לקוח / תאריכים / פריטים) עם "עריכה". אחרי עריכה, ברגע שמתקדמים מהשלב שנערך — חוזרים לסיכום (`returnToSummary` + `editingStepRef` + effect ניווט בלבד).
- **חלוניות** (Dialog): ציפוף, יציאה, לקוח כפול, הזמנה כפולה, swipe, חוסם "פעולה מתבצעת" = confirm; חיוב אשראי (עם קלטים) = form (בהיר בלבד). `window.confirm` של כפתור "אחורה" ו-`alert` המובנה הוחלפו בחלוניות v3 שנפתרות ב-Promise (`await showAlert(...)`), כך שהזרימה נשארת חוסמת כמו קודם.
- **התראה**: אחרי `POST /api/orders` מוצלח, לפני `router.push`, `enqueueNotice({kind:'success', persistToBell:true, href})` ב-try/catch; תזמון וסדר הניווט לא שונו. `data.warning` נשאר כחלונית חוסמת (כדי לא לשנות תזמון הניווט).
- מתגים (`Switch`) במקום checkbox/switch ידני; טאבים, `Seg` לריווח ולסוג האירוע; `Row/Rows` (נתון בשורה נפרדת); הסברים ב-`Tip`; כל האיקונים דרך `<Icon>`.

## שכתובי מלל בולטים
- כותרות שלבים: "מי הלקוח?" ← "עבור מי ההזמנה?"; "מתי האירוע?" ← "לאיזה תאריך?"; "אילו פריטים?" ← "מה מזמינים?"; "סיכום" ← "בדיקה לפני תשלום"; "תשלום וסיום" ← "תשלום ושמירה".
- "אישור תשלום" ← "הוספת תשלום"; "חיוב אשראי" ← "חיוב באשראי"; "כן, זה הלקוח" ← "זה הלקוח".
- ההודעות (alert) קוצרו; הוסר האמוג'י מהערת הציפוף. מחרוזות-נתונים נשארו (`יציאה באישור מנהל`, `אישור נדרים`, ערכי כיוון משלוח, `requiredLevel`).

## חריגות מודעות
1. **Escape**: `Dialog` סוגר ב-Esc את כל החלוניות שהמרתי (ציפוף/יציאה/לקוח כפול), בעוד שהחוזה (סעיף 20) ציין שהן לא נסגרות ב-Esc. הפעולה שווה ל"ביטול" — בטוחה. חלונית "הזמנה כפולה" וחוסם הפעולה לא נסגרים כלל (נשמר).
2. **back של דפדפן**: החלונית אסינכרונית, לכן ה-handler מחזיר קודם את רשומת העצירה (`pushState`) ואז שואל; אישור יציאה = `history.go(-2)` (שקול ל-`back()` המקורי). כדאי לבדוק ידנית בדפדפן.
3. **כפתורי עריכה** נוספו לבלוקי "תאריכים" ו-"פריטים" בסיכום (במקור רק "עריכה" אחת → שלב 1). ניווט בלבד.
4. חלונית ה-alert ממוקמת מעל החוסם לפי סדר ה-mount (אותו z-index) — לבדוק שההודעה נראית בשגיאת שמירה.

## בקשות פתוחות
REQ-1..6 ב-`requests/ordernew.md` (עיקרית: גרסת v3 לרכיבים המשותפים: CustomerSelector, OrderModelSelector, שני בוחרי התאריך ושתי חלוניות התפוסה).

## ספקות
- לא הורצה בדיקת דפדפן מלאה (אין שרת פיתוח/התחברות בסביבה זו) — עברו eslint ו-build; נדרשת בדיקת RTL ב-`getBoundingClientRect` ובדיקת זרימת 5 השלבים בפועל.
- `data.warning` לא הומר ל-notice מסוג warn (כדי לא לשנות תזמון); אפשר להוסיף `enqueueNotice({kind:'warn'})` בנוסף לחלונית אם יאושר.
