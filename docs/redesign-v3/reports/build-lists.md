# דוח בנייה — משפחת "רשימות" (orders / rentals / refunds)

ענף: `redesign/site-v3-pages-lists` (מבוסס על `redesign/site-v3-2026-09-24`).
קבצים: `app/orders/page.js`, `app/rentals/page.js`, `app/refunds/page.js`, חדש: `components/lists/listKit.js` (עזר משותף לשלושתם בלבד).
בדיקות: `npx eslint` על הקבצים — נקי. **לא בוצע אימות חזותי בדפדפן** (אין `.env`/DB בעץ העבודה, ושרת ה-dev היחיד שייך לענף הבסיס).

## עקרונות שיושמו
- כל state / effect / fetch / cache key / handler / id נשארו זהים; שונו JSX, מחלקות, איקונים, מלל.
- `V3Page` כעטיפה; טבלאות `v3-table` (ישירות, כי `Table` לא תומך בלחיצת שורה — REQ-2).
- `window.customConfirm` / `customPrompt` / `alert` הוחלפו ב-`useListDialogs` (Dialog v3): אישור = variant confirm (כהה/בהיר נתמך), קלט ת"ז = variant form (בהיר), הודעות = חלונית עם כפתור "הבנתי" (חוסמת כמו alert המקורי, `await` היכן שהיה).
- אף קריאת notify לא נדרשת ב-§4 לקבצים אלה. `refunds:458,483` (מועמדים משניים) נשארו כחלונית הודעה חוסמת (כמו alert) — אפשר להמיר ל-`v3Toast` כשה-Provider יחובר (כרגע לא מחובר ל-layout).

## /orders — צ'קליסט חוזה (orders-list.md)
| פריט | איפה |
|---|---|
| טעינת settings + 6 מפתחות | ללא שינוי (effect בראש הקומפוננטה) |
| מפתח מטמון = URL / `buildOrdersUrl` / `subscribe` / `sortPendingFirst` | ללא שינוי |
| טאבי סטטוס (soon/archive/deleted/unpaid/drafts*/not_taken*/all) + effects החזרה ל-soon | `statusTabs` + `handleStatusTab` ("הכל" ← `handleShowAll`) |
| חיפוש טקסט (Enter/כפתור/ניקוי) + שאלות סטטיסטיקה (x,y) | `v3-filter-bar` |
| סינון מתקדם: 2 לשוניות, טווח תאריכים, סטטוס פריטים + בחר הכל, 7 שדות, דגם, AI-switch (`#orders-adv-ai-mode`, `.ai-feature-element`), נקה הכל (מרוקן גם eventDateFrom), החל | `<Dialog variant="form">` |
| כפתורי כותרת: מתקדם / תפוסה / הדפסה / ייצוא / הזמנה חדשה | `pagehead__tools` (הזמנה חדשה = `Link`, ניווט לקוח) |
| טבלה: מיון ב-6 מפתחות (orderId, customerName, eventDate, totalAmount, totalPaid, status) | כותרות עם `v3-th-btn` (מיון סכום/שולם בעמודת "תשלום") |
| שורה לחיצה ← `/orders/{id}`; stopPropagation בכל כפתור/ⓘ | נשמר |
| צביעת שורה: draft > spacing > pending > unpaid (+selected מת) | `ROW_TONES`, אותם תנאים |
| תג "לא נשמר" + Tip; `PendingTimer` (כולל "פג תוקף") | Chip + Tip |
| ⓘ כרטיס מהיר בריחוף (פורטל, מיקום JS פיזי) — נוסף גם מיקוד מקלדת | `v3-rich-tip` |
| פעולות שורה: כרטיס / השכרה-החזרה (`setRentalModalOrderId`) / מחיקה (חסימות, ת"ז, DELETE + headers) | נשמר; חלוניות v3 |
| עימוד (הקודם/הבא/מספר עמוד `#ordersListPageNum`) | נשמר, מנוטרל ב-AI |
| CapacitySearchModal, PrintWizardModal, RentalReturnModal (`onUpdate={fetchOrders}` בלי עטיפה), StatisticsModal | ללא שינוי |
| מצב ריק (חדש) / טעינה | `Empty` / loader |

## /rentals — צ'קליסט (rentals.md)
- hash `#rented/#returned` (init, hashchange, `switchTabGroup` עם `replaceState`) — ללא שינוי; `?orderId=` — ללא שינוי.
- לשוניות ראשיות = `Tabs`; תת-סינון "חלקי" = `Seg` (`setViewMode` בלבד).
- חיפוש רגיל / AI (שני טפסים), `RentedPastEventWidget` (ללא שינוי), ייצוא (ללא `onFetchData`), סינון מתקדם (2 לשוניות, `#rentals-adv-ai-mode`), מיון 3 מפתחות + eventDateSmart (אייקון "עולה"), שורה לחיצה, כפתור 📦 עם stopPropagation, "פירוט" מורחב.
- עמודות מינימליות (4): הזמנה+לקוח | תאריך | מצב | פריטים; **הערות** עברו לשורה המורחבת (לא נמחקו).
- קוד מת של החזרה מהירה (`handleQuickReturn`, `quickBarcode`...) נשמר כפי שהוא, כולל בדיקת איחור — ה-`customConfirm` שלו הוחלף ב-`v3Confirm`.

## /refunds — צ'קליסט (refunds.md)
- 3 טאבים, `DebtsTable` משותף (אותה חתימת props), טעינות/debounce/cache, `verifyPin` לפני הלולאה הסדרתית, `undoDebtApproval` = confirm ואז verifyPin (נשמרו שניהם).
- טאב זיכויים: 6 עמודות; **סיבה, פרטי בנק, אשראי מקורי, אימייל** — בשורה מורחבת. חיפוש מקומי + Seg הכל/ממתינים/בוצעו. פעולות: בוצע / בטל ביצוע / מחק.
- חובות: checkbox + בחר הכל (`selectableIds`), אייקון מאושר, סרגל בחירה, "טעינת עוד"; **סה"כ/שולם** בשורה מורחבת. הבחנת הצבע בין הטאבים נשמרה (plum מול rose-700).
- חלונית אישור תשלום = `Dialog confirm`; חלונית ייצוא = `Dialog form` (CSV, אותם שדות/פרמטרים).
- ה-callout של הטאב השלישי הפך ל-Tip ליד הטאבים; שם הטאב הוחלף ל"יצאו וטרם שולמו".

## שכתוב מלל בולט
"ניהול הזמנות" ← "ההזמנות"; "ארכיון/עבר" ← "ארכיון"; "מחוק" ← "מחוקות"; "הזמנות מאושרות ללא תשלום מלא" ← "יצאו וטרם שולמו"; "חפש בחכמה" ← "חיפוש חכם"; "ייצוא זיכויים להנה"ח" ← "ייצוא זיכויים להנהלת החשבונות"; כל ההודעות והאישורים נכתבו מחדש (כותרת + משפט קצר). תוויות `getLabel` — המפתחות ללא שינוי, רק ברירות המחדל.

## סטיות והחלטות
1. עמודות הטבלה צומצמו: orders — 6 (מספר+לקוח, דגם, תאריך, תשלום, מצב, פעולות); כמות פריטים/סכום/שולם ב-expanded. כפתורי מיון סכום ושולם נמצאים יחד בכותרת "תשלום".
2. צבעי שורה: inline style עם tokens (REQ-1).
3. Esc סוגר עכשיו את חלון הסינון המתקדם (לא היה) — ובעיית Esc מול בורר התאריכים (REQ-6).
4. כפתורי-איקון בשורות משתמשים ב-`title` + `aria-label` (לא Tip) כדי לא ליצור ~200 פורטלים; כפתורי הכותרת עם Tip (`IconAction`).
5. חצי עימוד: הקודם = `chevron-end`, הבא = `chevron-start` (RTL נכון, ראו REQ-7).

## ספקות פתוחים
- לא נבדק בדפדפן: רספונסיביות, מיקום `v3-rich-tip`, מראה שורות ה-tone. מומלץ סבב סוקרים חזותי.
- `ExportButtons` / `RentedPastEventWidget` / `OrderModelSelector` / `StatisticsModal` / RentalReturnModal — משותפים, נשארו בסגנון ישן (REQ-3..5).
