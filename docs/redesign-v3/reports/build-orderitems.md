# דוח בנייה — משפחת orderitems (טאב פריטים בכרטיס הזמנה)

ענף: `redesign/site-v3-pages-orderitems` (מבוסס על `redesign/site-v3-2026-09-24`).
קבצים ששונו: `components/orders/modern/ModernItemsManager.js`, `components/orders/OrderModelSelector.js`, `components/orders/OrderSizeSelector.js`, `components/orders/ItemCapacityModal.js`. קובץ חדש: `components/orders/orderItemsV3.css` (מחלקות `oi-*`, tokens `--v3-*` בלבד). `rentalToggle.js` — אין בו UI, לא שונה. `ModernRentalsManager.js` (קוד מת) — לא נגעתי. `app/api`, `lib`, `prisma`, `app/v3`, וקבצי עמודים — לא נגעתי.

## אימות שבוצע
- eslint על 4 הקבצים: נקי, מלבד 3 שגיאות react-hooks/refs+purity ב-OrderModelSelector שכבר היו בקוד המקורי (`autofillGuardNameRef`, נשמר בכוונה: מניעת autofill).
- עמוד בדיקה זמני (נמחק) עם 4 פריטים בכל המצבים על שרת dev מקומי: רינדור, פריט חדש (pending מקווקו), עריכה, מצב נעול (עץ הכפתורים זהה למקור), חלונית אישור, ברקוד ידני (form), פרטי פריט (sheet), תפוסה. RTL נבדק ב-getBoundingClientRect (איקון מימין, חץ בשמאל). אין בדיקה ויזואלית מלאה בגודל דסקטופ (חלון הדפדפן היה צר/מוסתר).
- לא נבדק מול DB אמיתי (ה-API החזיר 401 בעמוד הבדיקה): טעינת מידות, היסטוריה ונתוני תפוסה לא נראו עם נתונים.

## רשימת התאמה לחוזה (Part A + Part 0)
- ה-props וה-ref של ModernItemsManager ללא שינוי: `locked, orderId, order, items, onItemsChange, onOrderUpdated, inventoryCache, totalRequired, totalPaid`; `ref.scan(barcode)`. `onItemsChange` תמיד פונקציונלי.
- כל ה-state, ה-effects, ה-handlers וה-fetch (כתובות, method, מפתחות גוף, סדר, אישורי מנהל `feature:*`) — ללא שינוי. `originalIndex` בכל handler, מפתח שורה `id || _localId || index`, `_localId`/`savedLocalId`, `forceFullEdit`, `evaluateSizeSwap` (נקרא כמו קודם), חלון 15 דק', `sessionEditableIds/forceEditableIds`. נוסף state תצוגתי בלבד: `openItems`.
- ה-props של OrderModelSelector (`value,onChange,placeholder,inputId,hasActiveItems`), OrderSizeSelector (`modelId,order,value,onChange,placeholder,inventoryCache,currentCartItems`) ו-ItemCapacityModal (`item,order,isOpen,onClose`) ללא שינוי — משמשים גם את orders/new, orders/page, rentals.
- נשמרו: `data-agy-id` (`order_model_selector_input|dropdown_item|clear`, `order_size_selector_select|option`, `itemcapacitymodal_*`), `name` אקראי לבורר הדגם, debounce 300ms, Enter = פתרון הקלדה, portal של הרשימה עם מיקום פיזי (נמדד), סגירה בלחיצה בחוץ.
- נעילה (`locked`): החזרה בלבד, מתג מצב + ביטול החזרה לפריט מוחזר, "נעול" לשאר, אין "פריט חדש", סימון "תיקון בוצע" לא מגיב.
- מצבי עריכה: `canEditModelSize` / `canEditSizeOnly` / קריאה בלבד (פריטי Access), הודעת "החלון נסגר" + פתיחה מחדש באישור מנהל, שדות תיקון disabled כשהחלון סגור, פירוט תיקון תמיד ניתן לעריכה, חובה כשנבחר תיקון (`enableAlterations`).
- חלוניות: אישור השכרה/החזרה/ביטולים (+ אזהרת "לא שולם" + טיפ סריקה), בחירת פריט לברקוד, ברקוד ידני, פרטי פריט (חיובים, 3 תאריכים, היסטוריה מקופלת עם `dedupeAuditLogs`/`HIDDEN_HISTORY_FIELDS`/`FIELD_TRANSLATIONS`), תפוסה (KPI, רשימה/לוח שנה, `CapacityCalendar` כמות שהוא).

## החלטות עיצוב
- כרטיס פריט לפי סקיצה B: מקופל = איקון, שם (קישור לכרטיס הדגם), תגית מידה, קוד, תגית סטטוס, צ'יפי תיקון; מורחב = מחיר/ברקוד/תיקונים בשורות (R15) + כל הפעולות. שורה בעריכה או פריט חדש תמיד פתוחים (כרטיס מקווקו לפריט חדש = "לוח ההוספה").
- טבלה הוחלפה בכרטיסים; טבלת התפוסה נשארה טבלה מינימלית (תאריך, לקוח, כמות, קישור).
- בורר המידה: ריבועי מידה עם שורת זמינות במקום `<select>` (ייצוא נוסף `SizeChips` מ-OrderSizeSelector, משמש גם את "אותה קטגוריית מחיר"). אפשרות לא זמינה = מושבתת ומקווקוה. לחיצה על מידה שנבחרה מנקה אותה (כמו האפשרות "-").
- כל ההסברים עברו ל-`Tip` (חלון עריכה, סריקה מהירה, נעילה, חיובים, פירוט תיקון חובה).
- אין שדה סריקה בתוך הטאב (הוא בבעלות ModernOrderCard/page דרך `ref.scan`) — לכן לא נבנה "scan bar" כאן.

## שכתובי מלל בולטים
"הוסף פריט" → "פריט חדש" · "פריטים מחוקים" → "הצגת מחוקים" · "פרטי תיקונים" → "פרטי תיקון" · "השכרה"/"החזרה" → "סמן כמושכר"/"סמן כהוחזר" · "ביטול" (השכרה) → "ביטול השכרה" · "הוחזר - תקין/לא תקין" → "הוחזר תקין"/"הוחזר עם בעיה" · "ממתין" → "טרם הושכר" · חלונית אישור: "לסמן את X כמושכר?" · "לאיזה פריט לשייך?" · "הזנת ברקוד" · "בדיקת תפוסה" (במלאי/תפוסים/פנויים) · כל הודעות השגיאה וההנחיות (alert / customAuthPrompt / customConfirm / customPrompt) נכתבו מחדש; מפתחות ההרשאה וערכי הסטטוס לא שונו.

## סטיות מהכללים (ולמה)
1. **`alert()` נשארו קריאות `alert()` (רק המלל נכתב מחדש).** כיום `window.alert` מוחלף ב-toast על ידי PopupProvider, ו-`V3NotifyProvider` עדיין לא מחובר — מעבר ל-`v3Toast` היה גורם להודעות שגיאה להיעלם. הן יעברו אוטומטית כשיחברו את הגשר (REQ-4). הזרימה זהה.
2. **fallback של `window.prompt` (כש-`customPrompt` חסר) נשאר** — נתיב שלא רץ בפועל; החלפתו דורשת שינוי ב-PopupProvider (מחוץ לתחום).
3. **חלוניות אישור במצב בהיר** (ברירת המחדל של `Dialog`); אין כרגע מנגנון בחירת כהה/בהיר לפי העדפת משתמש. ברקוד ידני = form (בהיר בלבד, לפי R19).
4. תג "בוצע/לא בוצע" של תיקון — במקור היה גם הכפתור עצמו; עכשיו תגית בכרטיס + כפתור "סימון תיקון בוצע" בחלק המורחב (אותו handler). בהזמנה נעולה הכפתור מושבת (במקור: לא הגיב).
5. מחיר הפריט מוצג בחלק המורחב כשקיים (נתון שכבר נטען, לא הוצג בטבלה). אפשר להסיר.
6. `--oi-z-drop: 999999` ב-CSS של בורר הדגם — ערך z שמור מהמקור: הבורר חי גם בתוך חלוניות ישנות (z 1100) בעמודים שעוד לא הוסבו.

## בקשות פתוחות
ר' `docs/redesign-v3/requests/orderitems.md`: REQ-1 קריסת Dialog כשנטען פתוח (עקיפה מובנית ב-ItemCapacityModal) · REQ-2 מחלקות ריבוע מידה/כפתור-מתג · REQ-3 disabled ל-Seg · REQ-4 חיבור alert → v3Toast.

## ספקות
- IM עטוף ב-`V3Page page={false}` (מוסיף `data-v3` וטוען את הספרייט). אם בעל העמוד כבר עוטף — אין נזק (ספרייט כפול בלבד).
- לחיצה על שורת הראש של הכרטיס פותחת/סוגרת אותו (תצוגה בלבד, התנהגות חדשה); הקישור לכרטיס הדגם נשאר בטאב חדש.
- לא נבדק מול נתונים אמיתיים (זמינות מידות, החלפת מידה באותה קטגוריה). מומלץ מעבר ויזואלי של סוקר על הזמנה אמיתית.
