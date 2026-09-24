# אימות התאמה: ordernew (`/orders/new`)

ענף: `origin/redesign/site-v3-pages-ordernew` מול `origin/main`
קבצים: `app/orders/new/page.js` (2917 → 2661 שורות), `components/orders/new/NewOrderShell.js`
חוזה: `docs/redesign-v3/contracts/orders-new.md`
שיטה: חילוץ AST (babel) של שני העותקים: hooks + תלויות, גופי effects, כל ה-statements של הקומפוננטה (מנורמלים, diff ברמת טוקן), כל `fetch(` + ה-body (`JSON.stringify` 11 מול 11), מאפייני JSX לוגיים (onClick/onChange/value/disabled/checked/open...), מחרוזות-נתון, מפתחות `settings.*`, `hasPermission`, מזהים, בדיקת משתנים לא-מוגדרים. לא הורץ שרת.

## פסק דין: ⚠️ תואם עם הערות (אין פערים חוסמים)

לוגיקה, שערי שלבים, בניית גוף ה-POST, אוטוסייב הטיוטה, נתיבי האשראי, ההרשאות וההגדרות: זהים אחרי נרמול. כל השינויים בקוד הלוגי הם: (1) `alert`→`await showAlert` (חלונית חוסמת-עד-אישור, מלל שונה), (2) `window.confirm`→חלונית `leaveAsk` בשמירת אותה זרימה, (3) `enqueueNotice` לפני `router.push`, (4) מנגנון "חזרה לסיכום" חדש (ניווט בלבד). שלושה נושאים דורשים תשומת לב (ראו "הערות"), אף אחד לא משנה נתונים.

## טבלת חוזה

| פריט בחוזה | קיים בחדש (קובץ:שורה) | זהה? |
|---|---|---|
| שער שלבים `canNavigateToStep` (1 תמיד; 2 לקוח; 3 לקוח+תאריכים; 4/5 +פריט) | page.js:68-85 | זהה (גוף זהה אחרי נרמול) |
| `stepsMeta` (enabled/lockedReason/value) → Shell | page.js:1446-1471 | זהה; שונו רק מחרוזות תצוגה (`lockedReason`, "בדיקה אחרונה"→"בדיקה סופית") |
| `handleStepChange` (בדיקת שער + הודעת נעילה) | page.js:1473-1479 | זהה; ההודעה עכשיו `showAlert` לא חוסם-thread |
| כפתורי המשך/חזרה/ביטול/סיום | page.js:1614-1664 (`nextBtn`) | תנאי `disabled` ו-`onClick` זהים לישן (1→proceedToStep2 / 2→setStep(3) + validateDeliveryFields / 3→activeItems>0 / 4→setStep(5) / 5→saveOrder) |
| POST `/api/orders` – מפתחות body, זמן בנייה | page.js:1229-1320 (`executeSaveOrderForList`) | זהה, diff ברמת טוקן מראה רק alert/מלל/redirect; ה-body נבנה באותה נקודה (אחרי בדיקות, לפני fetch) |
| כל קריאות הרשת (13 URL, method, סדר פרמטרי query) | 11×`JSON.stringify` בשני העותקים | זהות (diff של רשימת `fetch(` ריק) |
| טיוטה: אוטוסייב 1500ms + תלויות | page.js:1012-1058 (`}, 1500`) | זהה (גוף ה-effect ותלויותיו זהים) |
| flash "נשמרה טיוטה #N" | Shell `flash` → `Banner` | תצוגה בלבד; ה-effect זהה (2800ms) |
| כפתור אשראי עוקף בדיקת תאריך עבר; חיוב מלא שומר ישירות | page.js:306-400 (`handleProcessCreditCard`) | זהה; רק מלל הודעות שונה; הענף "חיוב מלא -> executeSave ישירות" ללא שינוי |
| חיוב חלקי: alert ואז המשך | page.js:384 | `await showAlert` – אותו סדר |
| אישורי מנהל: `verifyPin` (missing_contact_approval, הנהלה ראשית, past_date_order_approval), `customAuthPrompt` (payment_exit_approval, special_spacing_approval) | page.js:552,596,631,1137,1176,1502 | אותם `requiredLevel` ואותו טיפול בערך חוזר; רק מלל השאלה שונה |
| `customConfirm` מחיקת פריט מהסל / חריגת שדות חובה | page.js (onClick removeItem; handleUseExistingCustomer) | אותו `await → boolean` |
| הגדרות per-org (`settings.*`) | – | 26 מפתחות בישן, 26 בחדש, קבוצה זהה; אין `hasPermission` שנוסף/נעלם |
| localStorage `gemach_last_order_branch` | page.js:425,1978 | זהה |
| מזהים/ids שקוד אחר צורך (`querySelector` בקלט Enter של לקוח חדש) | page.js:447 | קיים; `htmlFor`/`id` של Field עברו ל-`Field id=` (אין `getElementById` בקובץ) |
| ציפוף ימים: 6 אפשרויות (null,0-4), אישור מנהל כשיורד מתחת ל-3 | page.js:1934-1942, 1486-1520 | ערכים זהים (מחרוזת `'null'`→null, `Number(v)` אחרת); `handleSpacingChange` זהה |
| סוג אירוע (isAbroad) | page.js:1879 | `Seg` עם ערכי boolean, קורא ל-`handleDateChangeWithValidation('isAbroad', v)` כמו הכפתורים הישנים |
| טלפוני/סניף/משלוח/שולח הוראת קבע/הסכמות שיווק | page.js:1962-1980 ועוד | מקושרים לאותם `order.*` / `newCustomer.*`; `checkbox`→`Switch` |
| דיאלוג כפילות לקוח / כפילות הזמנה / יציאה / ציפוף / אשראי / swipe / busy | page.js:2401-2590 | אותם handlers; ראו הערות |

## פערים חוסמים

אין.

## הערות (לא חוסמות, לפי חומרה)

1. **מנגנון "חזרה לסיכום" (`returnToSummary`, page.js:65,1544-1552,1579-1583,1614) משנה זרימה רק אחרי לחיצה על "עריכה" בסיכום.** אין נגיעה ב-state של ההזמנה. שער השלבים נשמר (`canNavigateToStep(4)` בתנאי). אבל:
   - **קפיצה בסטפר בזמן עריכה**: אחרי "עריכה" ומעבר לשלב גבוה מהנערך (כולל לחיצה בסטפר על 5 "תשלום" או על 3 בעת עריכת שלב 1) נדחפים ל-4 (סיכום) במקום לשלב שנלחץ. שלב 5 נשאר נגיש בכפתור "להמשך: תשלום". דרוש אישור מוצר שזו כוונה.
   - **עריכת לקוח (שלב 1)**: לאחר `proceedToStep2` הזרימה קופצת ל-4 ומדלגת על שלב 2. ל-`validateDeliveryFields` יש תלות בעיר הלקוח (`order.selectedCustomer?.city`), כלומר החלפת לקוח יכולה להפוך את שדות המשלוח לחובה ללא הצגת שלב 2. רשת הביטחון קיימת: `saveOrder` (page.js:1130) והשרת בודקים ומחזירים הודעה, אז אין שמירה שגויה, רק גילוי מאוחר.
   - שלב 2 מתרנדר לרגע (commit אחד) לפני שה-effect דוחף ל-4. אם רכיב ילד בשלב 2 (תאריך עברי) מפעיל `onChange` ב-mount, יש תופעת לוואי. לא ניתן לאמת סטטית.
2. **כפתור אחורה בדפדפן (`history.go(-2)` במקום `history.back()`, page.js:1086-1102) שקול בכל מסלולי הכניסה שנבדקו.** הנימוק: הישן מאשר ואז `back()` בעמדה שאליה נחתו (X): מגיעים ל-X-1. בחדש הרשומה G' נדחפת מיד בעמדה X ואז `go(-2)` מ-G' מגיע גם ל-X-1. בסירוב שני המסלולים משאירים `[.., X, G']` עם `backGuardArmedRef=true`. תקף גם ל-pop קדימה (X=G) ולחיצות חוזרות תוך כדי חלונית (`leaveAskPendingRef` בולע, ה-push מחזיר את G'). **הבדל יחיד קטן**: הזמנה שנפתחה בלשונית חדשה בלי היסטוריה קודמת (`[P,G]`): ישן ב-אישור: `back()` מ-P לא זז (הגארד כבוי, לחיצה נוספת יוצאת). חדש: `go(-2)` מחוץ לטווח לא זז, נשארים על G', לחיצה נוספת חוזרת ל-P (הגארד כבוי, לא יוצאת) ורק השלישית יוצאת. לחיצה אחת נוספת בלבד, בלי אובדן נתונים.
3. **Esc על 3 דיאלוגים חדש; לא מוחק נתונים בשקט.** `Dialog` עושה Esc (רק העליון, capture+stopPropagation). כל `onClose` שווה לכפתור הביטול/הישאר: ציפוף→`setPendingSpacingChange(null)` (השינוי לא מתבצע); יציאה→`setShowExitConfirm(false)` (נשארים); כפילות לקוח→`setDuplicateCustomers([])` (רשימה בלבד, `newCustomer` נשאר); אשראי/swipe→סגירה רק כש-`!isProcessingCredit && !saving`; כפילות הזמנה ו-busy: no-op ו-`closeOnScrim={false}`; חלונית יציאה בדפדפן (leaveAsk) ב-Esc=`resolve(false)`=נשארים; alert ב-Esc=אישור. (הסגירה בלחיצה על הרקע כבר הייתה קיימת בישן ל-3 הראשונים; **חדש**: לחיצה על הרקע של swipe סוגרת אותו, ובלי שינוי נתונים.) עדיין מקושרת ה-Escape הגלובלית הישנה (page.js:1106) – מקבילה, לא מתנגשת.
   - **לא ניתן לאמת סטטית**: פתיחת `verifyPin`/`customAuthPrompt` (z-index 10000) בזמן שדיאלוג כפילות-לקוח פתוח (handleUseExistingCustomer:631) – Esc בתוך חלונית ההרשאה עלול לסגור את דיאלוג הכפילות שמתחת (Dialog תופס Esc בשלב capture). ההשפעה: רשימת הכפילויות נסגרת; ההמשך זהה.
4. **כפתורי "עריכה" חדשים בסיכום (page.js:2233,2240,2257)** רק `goEditFromSummary(1|2|3)`; הישן היה כפתור אחד `setStep(1)`. אין שינוי ב-state של ההזמנה.
5. **`enqueueNotice` (page.js:1360-1372) חדש**: לפני `router.push` (בתוך try/catch). כרגע `V3NotifyProvider` לא מחובר (README: "בשלב הבא") ולכן נכתב רק תור ב-localStorage. אחרי חיבור, `persistToBell:true` יגרום ל-**POST חדש `/api/notifications` (category `activity_note`)** – כתיבה לשרת שלא הייתה בישן ולא בחוזה. יש לאשר במפורש לפני חיבור הפרוביידר.
6. **Stepper**: צומת נעול לא קורא `onStep` ומציג `Tip` במקום `alert(lockedReason)`. השער עצמו זהה (`enabled=canNavigateToStep`, ו-`handleStepChange` בודק שוב).
7. **מלל**: כל הודעות ה-alert/verifyPin/שגיאות שונו ("אנא בחר"→"בחרו" וכו'). אין השוואה בקוד למחרוזות אלו (נבדק; ה-`error` של השרת מועבר as-is). חדש: `'· אזל'` (old-only) הוסר כמחרוזת ליטרלית; תצוגה בלבד.
8. RTL/עיצוב: אין `left/right` קשיחים חדשים נצפים בקוד; יש `style` inline מזעריים (`narrow`, `animation` ב-Shell). `Icon` דרך הרכיב. `bdi` לספרות קיים. אין `alert()` שנותרו.
9. **קומפילציה סטטית**: `@babel/parser` על שלושת הקבצים עובר; אין מזהים לא-מוגדרים; כל היבוא בשימוש (חוץ מ-`React`, כמו בישן).

## מה לא נבדק סטטית (דורש דפדפן)

- זרימת ה-popstate בפועל (Next app router patched pushState) בכל שילוב היסטוריה.
- מיקוד/Tab בין `Dialog` (z 100) לפופאפים הגלובליים (z 10000), ו-Esc כשהם פתוחים יחד.
- רינדור זמני של שלב 2 לפני הקפיצה ל-4 והשפעתו על `HebrewDatePicker`.
- מרחק בין `Stepper` לרכיבים המדביקים בפוטר (sticky) במובייל; קורא כרטיסים ב-`swipe` (`autoFocus`+`onBlur` refocus נשמר בקוד: page.js ~2570, אך תלוי בפוקוס-trap של Dialog).

## ראיות (מקוצר)

```
## hooks old=61 new=67   + alertQueue, leaveAsk, leaveAskPendingRef, returnToSummary, editingStepRef, useEffect[step,returnToSummary]
## effect bodies old=14 new=15   ~ popstate guard (confirm->leaveAsk, back->go(-2)); + returnToSummary effect
## fetch(...) sets: FETCH-SAME (13 URLs), JSON.stringify 11 == 11
## decls: unchanged except NewOrderPage; + showAlert, goEditFromSummary, nextLabelFor, Req
## settings.* keys old=26 new=26; hasPermission old-only=[] new-only=[]
## top-level (outside NewOrderPage): only NocCollapsible className + Req + imports
## statement diff (token-level, 15 changed handlers): differences = alert->await showAlert + Hebrew text,
   router.push -> const redirectHref + enqueueNotice, Hok fields JSX (Card/Field/Switch; value/onChange same state)
## unbound identifiers: none (old/new/Shell)
```
