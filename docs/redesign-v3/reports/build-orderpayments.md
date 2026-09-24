# דוח בנייה: orderpayments (טאב תשלומים בכרטיס ההזמנה)

קובץ בסקופ: `components/orders/modern/ModernPaymentsManager.js` בלבד. כל החלוניות (תקנון, סוויפ, אשראי, חיוב ידני, פרטי תשלום/חיוב, בקשת זיכוי, פרטי בנק, תשלום נוסף) הן inline בקובץ הזה, אין CSS ייעודי, אין קומפוננטות משותפות שנוגעים בהן.
ענף: `redesign/site-v3-pages-orderpayments` (מבוסס `redesign/site-v3-2026-09-24`).

## חוזה (Part B + Part 0): צ'קליסט
- Props ו-ref: `orderId, items, order, obligations, payments, refunds, onObligationsChange, onPaymentsChange, onRefundsChange, totalRequired, totalPaid, customer, onOrderUpdated, onSignRegulations, isLivePreviewing` ללא שינוי. ref: `openCreditModal`, `openPendingAutoRefundBankModal` (מחזיר boolean), `openAdditionalPaymentModal`, `openRefundModal` ללא שינוי.
- כל ה-state, ה-effects, ה-refs (`creditAmountRef` וכו'), `useCountdown`, `getCancellationCreditInfo`, `hasActiveObligationWithDescription`, חישוב `deliveryPrice`, `additionalPaymentMethodOptions`, ה-handlers והסדר של כל קריאות ה-API: זהים (POST /api/nedarim, POST /api/payments, POST/PUT /api/refunds, GET /api/orders/{id}, POST /api/admin/recalculations, PUT /api/orders/{id}, verifyPin).
- שמירה מיידית מול שמירה עם "שמור" של ההזמנה: נשמר בדיוק. מיידי בשרת: חיוב אשראי (+ענף "חויב אך לא נשמר"), תשלום נוסף, בקשת זיכוי, אישור זיכוי, פרטי בנק, חישוב מחדש, חתימת תקנון. מקומי עד "שמור": חיוב ידני/משלוח, מחיקת חיוב/תשלום, מעקף מתכנת.
- `removeObligation/removePayment` עדיין לפי `obligations.indexOf(obs)` / `payments.indexOf(p)`; `key={idx}` נשאר.
- תנאי הצגה נשמרו: `nedarim_plus_enabled`, `enable_deliveries`, `allow_additional_payment_on_order`, `consolidate_manual_payment_credit_ui`, `settingsLoaded`/`CANCELLATION_CREDIT_MINUTES`.
- אין נעילה חדשה (PM ללא read-only). חלונות אשראי וסוויפ: `closeOnScrim={false}` (כמו קודם).
- חלוקה: אריח "יתרת חוב" מוצג כש-balance>=0 (כעת מנוסח "ההזמנה שולמה במלואה" ב-0), "יתרת זכות" רק שלילי.

## מבנה חדש (סקיצה B)
1. אריח זיכוי ביטול עם ספירה (`v3-note`, הופך attn ב-60 שנ' האחרונות).
2. כרטיס "מצב תשלום": אריח יתרה (`v3-status` debt/credit/paid), פס התקדמות (אחוז נגזר מ-totalPaid/totalRequired, תצוגה בלבד), שתי שורות סה"כ/שולם, כפתור "תשלום באשראי ₪X".
3. "חיובים" (רשימה, שורת ספירה לאחור כ-Chip, פרטים/מחיקה כ-IconBtn, כפתורי משלוח מתחת).
4. "תשלומים שהתקבלו". 5. "זיכויים ממתינים" (עם chip "חסרים פרטי בנק").
6. אקורדיון "פעולות ידניות": הוספת חיוב, תשלום נוסף, בקשת זיכוי, חישוב מחדש.
- שורות `isNew`/`isPreview` (חיוב) ו-`isNew` (תשלום) מוצגות בסגנון "ממתין לשמירה" (`v3-li--pending`), מנתוני דגלים קיימים בלבד.

## חלוניות
- אישור: תקנון, מחיקת חיוב, מחיקת תשלום, אישור זיכוי, חישוב מחדש = `Dialog confirm` כהה (זרימת await זהה: `askConfirm` מחזיר Promise<boolean>, מחליף `window.customConfirm`).
- סוויפ: confirm בהיר (יש קלט מוסתר). אשראי, חיוב ידני, בקשת זיכוי, פרטי בנק, תשלום נוסף = `form` בהיר. פרטי תשלום/חיוב = `sheet` בהיר.
- כל `alert()` הוחלף בחלונית הודעה (`showMessage`, nested, לא חוסמת את הזרימה, כמו ה-alert שהיה בפועל טוסט). אזהרת "חויב אך לא נשמר" נשארת חלונית בולטת (warn).

## כתיבה מחדש בולטת
"דמי ביטול/זיכוי ביטול" לא שונו (מלל נתונים). כותרות: "מצב תשלום", "תשלומים שהתקבלו", "פעולות ידניות". הסברי ההוספה/זיכוי החריגים עברו מפסקאות ל-Tip. "בצע חיוב" -> "חיוב הכרטיס", "אשר ביצוע" -> "אישור ביצוע", "העברה מהירה" -> "העברה בקורא מגנטי", "מעקף" -> "מעקף מתכנת" + Tip.
מחרוזות שמוצגות בלבד ושונו: הודעות creditError/additionalPaymentError/שגיאות alert (אף אחת לא מותאמת בקוד).

## חריגות והחלטות
- הוסר `createPortal` (Dialog עושה portal בעצמו); `mounted` נשאר ומגביל את רינדור החלוניות.
- כפתור רענון/חישוב מחדש עבר מאריח ה"סה"כ" לאקורדיון (כמו הסקיצה). כפתור אשראי עבר לכרטיס מצב תשלום.
- מהסקיצה בלי לוגיקת backend ולכן לא נבנו: כפתור "ביטול זיכוי" באריח הזיכוי, בחירת "שובר/החזר כספי" ו-IBAN יחיד (B5), חיוב/זיכוי ממתין נטו מהעגלה, "זכה ₪X" כפעולה נפרדת.
- לא נבנו התראות (NOTIFICATIONS §4 לא כולל את הקובץ).

## בקשות פתוחות
- `verifyPin` (mocAuth.js, משותף) עדיין קורא ל-`window.customAuthPrompt` (PopupProvider) לקוד מנהל/מתכנת: מחוץ לסקופ; יוחלף במסגרת ה-Dialog code של הבעלים. אין קובץ בקשה נפרד כי לא נדרש שינוי בספרייה.

## ספקות
1. **באג קיים נשמר (R8):** בחלוניות בקשת זיכוי ותשלום נוסף גם ה-input וגם עטיפת החלון מאזינים ל-Enter, ולכן Enter בשדה מפעיל `submitRefund`/`submitAdditionalPayment` פעמיים (שתי קריאות POST). לא תוקן. מומלץ `e.stopPropagation()` באישור.
2. לא נבדק חזותית בדפדפן (הבדיקה דורשת התחברות ושרת dev יחיד). eslint על הקובץ נקי. מומלץ לבדוק RTL עם getBoundingClientRect בשילוב עם העמוד.
3. הקובץ מסתמך על `data-v3` שהוא עוטף בעצמו (`V3Page page={false} sprite={false}`); האייקונים דורשים שה-IconSprite הקיים כבר טעון בעמוד (כמו קודם).
