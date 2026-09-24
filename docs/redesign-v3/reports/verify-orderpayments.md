# אימות התאמה: orderpayments (`ModernPaymentsManager.js`)

בסיס: `origin/main` מול `origin/redesign/site-v3-pages-orderpayments` (קומיט 4ce8e4e). קובץ בסקופ: `components/orders/modern/ModernPaymentsManager.js` בלבד (בנוסף רק `app/version.json`, `package.json`, דוח הבנייה). לא נגעו ב-`lib/` או `app/orders`.

## פסק דין: ⚠️ תואם עם הערות

לוגיקה, state, effects, ref, קריאות רשת וסדרן: זהים בית-בית. ההבדלים בלוגיקה הם מחרוזות תצוגה, החלפת `customConfirm`/`alert` והוספת 5 משתני תצוגה נגזרים. אין פער חוסם. שני סיכונים קטנים לא חוסמים (Escape על חלון האשראי/סוויפ, פוקוס ברירת מחדל בחלון מחיקה), ובאג ה-Enter הכפול מאושר כקיים-מראש.

## שיטה ואמצעי הוכחה

בוצע `diff -w` בין אזור הלוגיקה של הישן (שורות 1-795) לחדש (1-816), כלומר כל מה שלפני `return (` הראשי. פלט מקוצר:

```
- import { createPortal }                  (הוסר; Dialog עושה portal בעצמו)
+ import { V3Page, Card, Btn, IconBtn, Chip, Field, Row, Rows, Tip, Dialog, Empty, Banner, Icon }
+ const fmtMoney = ...                     (תצוגה)
~ CancellationCreditBadge / CreditWindowTile  JSX בלבד (useCountdown, deadline, urgent: זהים)
+ confirmState/askConfirm/settleConfirm, messageState/showMessage   (החלפת customConfirm/alert)
~ 4x window.customConfirm -> askConfirm(...)    ~ 13x alert(...) -> showMessage(...)
~ setCreditError/setAdditionalPaymentError/throw new Error(...) : מחרוזות בלבד
+ paidPct, statusKind, cleanItemTag, submitRefundOnEnter, submitAdditionalOnEnter, messageMeta  (תצוגה/מטפלי Enter זהים בגוף)
```
אין שום שורת diff ב: כל `useState/useRef/useEffect` (שמות ומערכי תלות), `useImperativeHandle`, `forwardRef` + חתימת ה-props, `fetch` (URL, method, body, סדר), `addObligation/removeObligation/removePayment/submitRefund/submitAdditionalPayment/approveRefund/handleRecalculate/handleProcessCreditCard/handleBypassCreditPayment/submitAutoRefundBank/confirmSignedThenOpenCredit/handleOpenCreditModal/openCreditModalNow/handleSwipeInputChange/handleCardNumberChange/handleTokefChange`, `getCancellationCreditInfo`, `deliveryPrice`, `additionalPaymentMethodOptions`, `settingsLoaded`.

קומפילציה: `@babel/parser` (jsx) עבר; `eslint --stdin` על הקובץ החדש נקי (אין no-undef, imports תקינים); כל שמות ה-Icon בשימוש קיימים בספרייט; `Field/Btn/IconBtn/Card/Row/Chip/Banner/Empty/Tip/Dialog` מיוצאים מ-`app/v3/ui/components.js` וה-props בשימוש נתמכים (Field `as="select"` מעביר value/onChange; Dialog מעביר `onKeyDown` דרך `...rest` לשורש הדיאלוג; Btn `loading` מנטרל).

## טבלת חוזה

| פריט בחוזה | קיים? (חדש, שורה) | זהה? |
|---|---|---|
| Props: orderId, items, order, obligations, payments, refunds, on*Change, totalRequired, totalPaid, customer, onOrderUpdated, onSignRegulations, isLivePreviewing | חתימת `forwardRef` (~שורה 88) | זהה (אין diff) |
| Ref: openCreditModal, openPendingAutoRefundBankModal (boolean), openAdditionalPaymentModal, openRefundModal | `useImperativeHandle` 489 | זהה בית-בית |
| Dialog-ים תמיד mounted (ref עובד כשהטאב לא פעיל) | `mounted && <Dialog open=...>` 1000-1420 | זהה בהתנהגות |
| אריחי סיכום: סה"כ / שולם / חוב-זכות / חלון זיכוי | כרטיס "מצב תשלום" 822-860, `CreditWindowTile` 819 | קיים. חוב/זכות: ב-balance=0 מוצג "ההזמנה שולמה במלואה" במקום "יתרת חוב ₪0" (תצוגה, ראו הערה 3) |
| `isLivePreviewing` ספינר | 838-843 | קיים |
| רענון/חישוב מחדש + customConfirm | כפתור באקורדיון "פעולות ידניות" ~1000; handler 338 | handler זהה; הכפתור עבר לאקורדיון (הכל נגיש) |
| חיובים: מיון, אייקון, סכום שלילי, פרטים, מחיקה (`isManual!==false`), `obligations.indexOf(obs)` | 866-900 | זהה; `key={idx}` נשמר |
| כפתורי משלוח הלוך/חזור (`enable_deliveries`, disabled אם קיים) | ~905-930 | זהה |
| "הוסף חיוב" | אקורדיון ~985 (`setShowAddChargeModal(true)`) | זהה |
| תשלומים: מיון, פרטים, מחיקה לכל תשלום (כולל אשראי), `payments.indexOf(p)` | ~940-965 | זהה |
| אשראי נדרים: תנאי `nedarim_plus_enabled !== 'false'`, דרך `handleOpenCreditModal` (תקנון ראשון) | כפתור 851 | זהה |
| זיכויים ממתינים + "הזנת/עריכת פרטי בנק" + "אשר ביצוע" (disabled `isProcessing` = `loading`) | ~970-1000 | זהה |
| תשלום נוסף (`allow_additional_payment_on_order`) ו-בקשת זיכוי (`consolidate…!=='true'`) | ~1005-1020 | זהה |
| חתימת תקנון (מנעול `confirmingSigned`) | Dialog ~1043 | זהה. תווית "לא (ביטול)" -> "עדיין לא" (מלל) |
| סוויפ: input שקוף, autoFocus, onBlur מחזיר פוקוס, Enter חסום, ללא סגירה ברקע | ~1056-1078 | זהה |
| אשראי: 5 שדות + refs + `focusNextOnEnter` + Enter בהערות שולח | ~1086-1180 | זהה. `closeOnScrim={false}` |
| מעקף מתכנת (`verifyPin`, יצירה מקומית, disabled בעיבוד) | כפתור בפוטר ~1108 | זהה |
| הוספת חיוב ידני (disabled כשחסר) | ~1183 | זהה |
| פרטי תשלום / פרטי חיוב (JSON notes, ניקוי `(פריט #id)`) | ~1219-1290 | זהה; `cleanItemTag` = אותו regex |
| בקשת זיכוי (8 שדות, Enter בכל שדה + בעטיפה) | ~1295-1345 | זהה (ראו Enter כפול) |
| פרטי בנק לזיכוי (autoFocus בנק, Enter, לא נסגר בשמירה) | ~1348-1375 | זהה |
| תשלום נוסף (select מהגדרה בלי "אשראי", סכום, הערה, שגיאה) | ~1378-1420 | זהה |

## שמירה מיידית מול "שמור" (Part 0 + P-e.292): ללא שינוי
- מיידי בשרת (נשאר): `POST /api/nedarim` ואז `POST /api/payments` (אשראי, כולל ענף "חויב אך לא נשמר"), "תשלום נוסף" (`POST /api/payments`), בקשת זיכוי, אישור זיכוי, פרטי בנק, חישוב מחדש, `PUT /api/orders {hasSignedRegulations}`.
- מקומי עד "שמור" של ההזמנה (נשאר): מעקף מתכנת, חיוב ידני, חיוב משלוח, מחיקת חיוב, מחיקת תשלום. הקריאות ל-`onObligationsChange/onPaymentsChange` זהות (מערך, לא פונקציה), וה-side-effect של `updated[idx].isDeleted` נשמר.
- הטקסטים החדשים אפילו מסבירים זאת נכון ("יירשם כשתשמרו" מול "נשמר מיד").

## Enter שולח פעמיים: קיים-מראש, לא נוצר ע"י ה-Dialog
✅ **הבאג קיים בישן.** בישן: עטיפת `.modal` בבקשת זיכוי (old:1360) ובתשלום נוסף (old:1446) עם `onKeyDown` שקורא ל-`submitRefund`/`submitAdditionalPayment`, וגם כל `<input>` בפנים (old:1370-1395, 1470, 1477) עם `onKeyDown` זהה. `preventDefault` לא עוצר bubbling, ו-`isProcessing` ב-closure עדיין `false` בשני הקריאות באותו אירוע => שתי קריאות POST (`/api/refunds`, `/api/payments`).
בחדש: אותה מבנה בדיוק. `Dialog` מעביר `onKeyDown` דרך `...rest` לשורש הדיאלוג (Dialog.js:62), שהוא אב של ה-inputs, כמו `.modal` הישן. `Dialog` עצמו לא מטפל ב-Enter (רק Escape/Tab ב-capture). כלומר אותה התנהגות, לא חמורה יותר ולא קלה יותר. בדיאלוג פרטי הבנק (עטיפה בלבד, אין onKeyDown על ה-inputs) ובאשראי (Enter רק בהערות, ללא עטיפה) אין כפילות, כמו בישן.
המלצה (לא לתקן בענף הזה): `e.stopPropagation()` ב-`submitRefundOnEnter`/`submitAdditionalOnEnter` או הסרת מאזין העטיפה. דורש החלטת בעלים כי זה שינוי התנהגות (R8).

## שלוש הפיצ'רים "רק בסקיצה": מוסתרים, לא מזויפים
grep בקובץ החדש: אין "ביטול זיכוי" ככפתור, אין IBAN, אין בחירת "שובר/החזר כספי", אין "זכה ₪X" כפעולה, אין סכום נטו חי בעגלה. דוח הבנייה מפרט את אותם פריטים כ"לא נבנו" (B5, B6, "ביטול זיכוי" באריח, "זכה ₪X"), והם אכן חסרים בקוד. הדברים החדשים בתצוגה נגזרים מנתונים קיימים בלבד: `paidPct` מ-`totalPaid/totalRequired`, "ממתין לשמירה" מדגלי `isNew/isPreview` הקיימים (`v3-li--pending`), chip "חסרים פרטי בנק" מאותו תנאי `!bankName?.trim()||!bankBranch?.trim()` של הכפתור. אין כפתור מת ואין קריאה חדשה. ✅

## החלפות customConfirm / alert
- `customConfirm` ×4 (מחיקת חיוב, מחיקת תשלום, אישור זיכוי, חישוב מחדש): `askConfirm()` מחזיר `Promise<boolean>` דרך `setConfirmState({...opts, resolve})`. כפתור ראשי -> `settleConfirm(true)`; ביטול, Escape ולחיצה על ה-scrim -> `settleConfirm(false)` (כי `onClose`). שורת ה-`await` והתנאי `if (!(await …)) return;` נשארו זהים, כך שענפי הביטול והערך החוזר נשמרו. ✅
- `alert` ×13 -> `showMessage(text, kind)`. לא חוסם (alert המקורי כן היה חוסם), אבל אף קוד לא הסתמך על ההמתנה: אחרי כל alert הקוד רק סוגר חלון/עושה GET, וסדר הפעולות נשמר. אזהרת "הכרטיס חויב אך לא נשמר" נשארת חלונית `warn` בולטת עם כל הטקסט הכספי. ✅
- שאר החלונות שנקראים מחוץ לקובץ (`verifyPin` -> `window.customAuthPrompt`) לא שונו (מחוץ לסקופ, מתועד בדוח הבנייה).

## קרדיט ביטול / ספירה לאחור
`useCountdown` (interval 1s, `null` כשפג, `urgent` ≤60ש'), `getCancellationCreditInfo` (prefix "דמי ביטול", `consumed`, `deletedAt`, `CANCELLATION_CREDIT_MINUTES`), `nearestCreditWindow` ו-`settingsLoaded`: אין שום שורת diff. רק ה-JSX של התגית והאריח הוחלף (Chip/`v3-note`). האריח מוצג רק כשקיים חלון ולא פג. מלל הנתונים "דמי ביטול"/"זיכוי דמי ביטול" ב-`getObligationIcon` ללא שינוי. ✅

## פערים חוסמים
אין.

## הערות לא חוסמות
1. **Escape על חלון האשראי והסוויפ (חדש):** `Dialog` סוגר ב-Escape גם כשה-`isProcessing`. בישן לא היה Escape, אבל היה כפתור X שגם הוא לא נעול בעיבוד (old:1132), אז אין רגרסיה בפועל: אין ביטול של הבקשה, וההצלחה עדיין סוגרת/שומרת. אם רוצים לשמור על נתוני הכרטיס יש להתאים `onClose={() => { if (!isProcessing) setShowCreditModal(false); }}`. חלון האשראי מחזיק PAN, ו-Escape בטעות מוחק מילוי חלקי, בדיוק מה ש"אין סגירה על הרקע" נועד למנוע.
2. **פוקוס ראשוני:** `Dialog` מפעיל פוקוס על האלמנט הראשון (הכפתור הראשי, "מחיקה"/"אישור הזיכוי") בחלוני האישור, כך ש-Enter מיד מאשר פעולה הרסנית או כספית. ב-`customConfirm` הישן ייתכן שהיה זהה. מומלץ `initialFocus` על "ביטול" לאישור הזיכוי.
3. **תצוגה בלבד:** ב-balance=0 מוצג "ההזמנה שולמה במלואה" (חוזה P-k.10 מציין שהישן הציג "יתרת חוב ₪0"). מכוון, אין השפעה על נתונים.
4. אריח/מספרים: כפתור רענון עבר מהאריח לאקורדיון "פעולות ידניות" (סגור כברירת מחדל). מומלץ לוודא שהעובדים מוצאים אותו. `Tip` מחליף `title` על כפתורי משלוח בשלב ה-disabled.
5. `Dialog` סוגר גם ב-`onMouseDown` על ה-scrim, לא ב-`onClick`: גרירה שמתחילה בתוך הדיאלוג ומסתיימת ברקע לא תסגור (שיפור). בדיאלוג הוספת חיוב/בקשת זיכוי יש סגירת רקע גם בישן.
6. `document.body.style.overflow`/נעילת גלילה נעשית ע"י `Dialog` (חדש), ו-`prev.focus()` בסגירה. לא היה בישן; יש לבדוק בדפדפן שלא משפיע על סליקת סוויפ (הפוקוס חוזר לשדה השקוף אחרי 100ms דרך `onBlur`).
7. RTL: אין `left/right/margin-left` קשיחים; סכומים בתוך `<bdi>`, שדות מספר עם `dir="ltr"`, `marginInlineStart:'auto'` לכפתור המעקף (בישן `marginInlineEnd`, שינוי לצורך הפוטר החדש `v3-mail__actions`, ראו מה לא נבדק). אין `alert()` שנותרו. כל האייקונים דרך `<Icon>`/`icon=`.

## מה לא נבדק סטטית (דורש דפדפן)
- מיקום כפתור המעקף והטיפ בפוטר (`marginInlineStart:'auto'` בתוך `v3-mail__actions` שהוא flex?), וסדר הכפתורים ב-RTL (getBoundingClientRect).
- שהסוויפ עדיין מקבל את הקלט מהקורא המגנטי (פוקוס + trap של Dialog + `onBlur`), ומעבר אשראי->סוויפ->אשראי עם ה-`setTimeout 150ms`.
- Enter כפול: הדגמה בפועל (ספירת POST ב-Network) בשני הענפים.
- ערימת דיאלוגים: חלון אישור/הודעה (`nested`) מעל דיאלוג טופס פתוח (בקשת זיכוי + הודעת ולידציה), ופוקוס אחרי סגירה.
- אייקוני sprite: `receipt`/`settings` נמצאים בקוד אבל ה-IconSprite הראשי לא נבדק מול כל ה-id (הישן השתמש ב-`#i-receipt`, כך שכנראה קיים).
- מצבי נתונים אמיתיים: חלון קרדיט פג בזמן פתוח, זיכוי אוטומטי בלי בנק (`openPendingAutoRefundBankModal`), הזמנת נווה יעקב עם `consolidate_manual_payment_credit_ui`.
