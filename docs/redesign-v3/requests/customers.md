# בקשות - משפחת "לקוחות"

## REQ-C1 · כל הלקוחות · התראות · חוסם
מה: `V3NotifyProvider` עדיין לא מחובר ל-`app/layout.js`. `enqueueNotice` נקרא אחרי שמירה/יצירת לקוח (הצלחה בלבד), אבל בלי ה-Provider המשתמש לא רואה שום משוב על שמירה (ה-`alert('הפרטים נשמרו בהצלחה!')` הוסר).
איפה: `app/customers/[id]/page.js` (`handleSave`).
איך לתקן: לחבר את ה-Provider בשלב האינטגרציה (ראו `app/v3/notify/README`) לפני מיזוג הענף.
סטטוס: פתוח

## REQ-C2 · ExportButtons · חלונית / כפתור · בינוני
מה: `components/ExportButtons.js` (משותף) עדיין בעיצוב ישן (`btn btn-secondary`, מודל `modal-backdrop`, `alert`). נשאר כמו שהוא ברשימת הלקוחות.
איך לתקן: לבנות מחדש כרכיב v3 משותף (חלונית טופס בהירה, `data-agy-id` נשארים).
סטטוס: פתוח

## REQ-C3 · StatisticsModal · חלונית · בינוני
מה: `app/components/StatisticsModal.js` (משותף) בעיצוב ישן; משתמש ב-`window.customConfirm`.
סטטוס: פתוח

## REQ-C4 · ChangesChips / HistoryViewer · קוסמטי
מה: `components/modern/ChangesChips.js` ו-`ACTION_TRANSLATIONS` מ-`components/HistoryViewer.js` משותפים ונשארו; לשונית "היסטוריה" בלקוח משתמשת ב-`ChangesChips` בעיצוב הישן. כשיהיה פיד ההיסטוריה `hf-*` (HISTORY-DESIGN) כדאי להחליף.
סטטוס: פתוח

## REQ-C5 · mocAuth.verifyPin · חלונית קוד · בינוני
מה: "שליחת מייל" מבקשת קוד מנהל דרך `verifyPin` (`components/orders/modern/mocAuth.js`) שנשען על `window.customAuthPrompt` (PopupProvider). מחוץ להיקף. להמיר לחלונית `Dialog variant="code"` + `CodeInput` בבעלות משפחת החלוניות.
סטטוס: פתוח

## REQ-C6 · Table (ספריית v3) · יכולת חסרה · קוסמטי
מה: ל-`Table` אין תמיכה בלחיצה על שורה שלמה (ניווט) ובמיון-שרת. ברשימת הלקוחות נבנתה טבלה עם מחלקות `v3-table` ידנית (עם `tabIndex` + Enter). אם מוסיפים `onRowClick` / מצב מיון חיצוני - אפשר להחליף.
סטטוס: פתוח

## REQ-C7 · Banner · פעולה ככפתור · קוסמטי
מה: ב-`Banner` הפעולה ("ביטול חסימה") מוצגת כקישור-טקסט עם חץ. עבור פעולה משמעותית (ביטול חסימת לקוח) עדיף כפתור `Btn`.
סטטוס: פתוח
