# חוזה: רשימת לקוחות — `/customers`

קבצים: `app/customers/page.js` (P), `app/customers/layout.js` (L), `components/ExportButtons.js` (EB), `app/components/StatisticsModal.js` (SM), `app/lib/pageCache.js`, `app/lib/prefetchRoutes.js` (`buildCustomersListParams` :59-74), `app/components/LabelsContext.js`, `app/api/customers/route.js` (GET).

## (א) מטרה והרשאות
- רשימת לקוחות עם חיפוש (רגיל / AI), סינון מתקדם, מיון, עימוד, ייצוא, שאלות-סטטיסטיקה AI, מעבר לכרטיס לקוח / יצירת לקוח.
- גישה: `L:1-7` -> `<PageGate pageKey="page:customers">` (שרת; `canOpenPage` ב-`lib/permissions.js`; קטלוג `/admin/permissions`). ללא גישה: `NoAccessMessage`. אותו layout חל גם על `/customers/[id]` ו-`/customers/new`.
- API: `GET /api/customers` דורש `checkAuth()`.
- ייצוא: כמות שורות מרבית ללא אישור מנהל = `employee.exportMaxRows` (מ-`/api/me`; ברירת מחדל 200); מעבר לזה — PIN עם `requiredLevel: 'feature:export_over_limit_approval'`.

## (ב) אזורים לפי סדר
1. `.page-head` (P:245-282): `h1` "ניהול לקוחות" + `.page-desc` `סה"כ רשומות: {totalCount}`; פעולות: כפתור חיפוש מתקדם, `ExportButtons`, "לקוח חדש".
2. `.toolbar` (P:285-340): טופס חיפוש — מצב רגיל או מצב AI (`aiInputMode`).
3. גוף: `loading && customers.length===0` -> `.loading-inline` "טוען נתונים..."; אחרת `.table-wrap` (P:345-427): `table.data` + `.table-foot` (ספירה + עימוד).
4. `StatisticsModal` (P:430-436) — פורטל.
5. מודל "חיפוש מתקדם (לקוחות)" (P:439-551), `maxWidth 600px`, שתי לשוניות.

עמודות הטבלה (סדר): קוד לקוח (`legacyId`) · שם פרטי · שם משפחה · טלפון (`phone1`) · עיר · דוא"ל.

## (ג) שדות / קלטים
| מיקום | תווית / placeholder | state | הערות |
|---|---|---|---|
| P:318-323 | placeholder `חיפוש לקוח (שם, טלפון, עיר)...` | `searchInput` | טקסט חופשי; submit -> `handleSearch` (`search=searchInput`, `page=1`, `isAiModeActive=false`) |
| P:291-297 | placeholder `בקש מה-AI למצוא נתונים (למשל: 'לקוחות מירושלים')...` | `aiInputText` | `disabled={aiLoading}`; submit ריק (trim) = no-op |
| P:398-413 | `#customers-page-num`, תווית "עמוד" | `page` | `type=number min=1 max=totalPages`; onChange מקבל רק `1<=parseInt<=totalPages`; disabled ב-`aiLoading`; ב-AI mode -> `handleAiPageChange(v)` |
| P:467 `#adv-search-firstname` | `getLabel('customer_firstName','שם פרטי')` | `advFilters.firstName` | לשונית "שם" |
| P:477 `#adv-search-lastname` | `getLabel('customer_lastName','שם משפחה')` | `advFilters.lastName` | לשונית "שם" |
| P:492 `#adv-search-phone` | `getLabel('customer_phone1','טלפון')` | `advFilters.phone` | לשונית "פרטי קשר" |
| P:502 `#adv-search-city` | `getLabel('customer_city','עיר מגורים')` | `advFilters.city` | לשונית "פרטי קשר" |
| P:512 `#adv-search-email` | `getLabel('customer_email','דוא"ל')` | `advFilters.email` | לשונית "פרטי קשר", מלוא הרוחב (`gridColumn 1/-1`) |
| P:526 `#customers-adv-ai-mode` | "חפש עם AI על השדות שמולאו" | `advAiMode` (checkbox) | עטוף `.ai-feature-element` (מוסתר ב-`body.hide-ai-features`, `globals.css:1820`) |
- אין ולידציה בצד לקוח; אין שדה חובה.
- מיון: `sort` (ברירת מחדל `'legacyId'`), `order` (`'desc'`); `limit=50` קבוע.

## (ד) כפתורים / פעולות
| תווית / title | handler | מה קורא |
|---|---|---|
| איקון רשימה, title "חיפוש מתקדם" (P:251) | `setShowAdvSearch(true)` | פותח מודל |
| ExportButtons | ראו להלן | |
| "לקוח חדש" (P:274) | `router.push('/customers/new')` | ניווט |
| "חיפוש" submit (P:336) | `handleSearch` | fetch דרך effect |
| "ניקוי חיפוש" X (P:326; רק אם `searchInput`) | `handleClearSearch` | מאפס `searchInput/search/page=1`; אם AI פעיל: `isAiModeActive=false, aiWhereClause=null, aiPromptUsed=''` (לא מאפס `aiQueryUsed`) |
| כוכב "חיפוש חכם (AI)" (P:330 / P:304) | `toggleAiInputMode` | בכניסה `aiInputText=searchInput`, ביציאה `searchInput=aiInputText` |
| activity "שאלות סטטיסטיקה" (P:333 / P:307) | `setShowStatistics({x:e.clientX,y:e.clientY})` | פותח `StatisticsModal` ממוקם בנקודת הלחיצה |
| X "נקה" במצב AI (P:300; רק `aiInputText && !aiLoading`) | `setAiInputText('')` | |
| "חפש בחכמה" submit (P:310) | `handleAiInputSubmit` -> `handleAiSearch(aiInputText)` | טקסט `מייצר שאילתה...` ו-disabled בזמן `aiLoading` |
| כותרות עמודה (P:350-367) | `handleSort(col)` | אותה עמודה: היפוך asc/desc; אחרת `sort=col, order='asc'`. **לא** מאפס `page`. אייקון: `#i-sort` (לא פעיל) / `#i-chevron-down` מסובב 180° ב-desc, צבע `--primary-solid` |
| שורת לקוח (P:372) | `router.push('/customers/${customer.id}')` | כל השורה לחיצה |
| "הקודם" (P:388) title "עמוד קודם", `disabled: page<=1 \|\| aiLoading` | AI: `handleAiPageChange(page-1)`; אחרת `setPage(p=>p-1)` | |
| "הבא" (P:416) title "עמוד הבא", `disabled: page>=totalPages \|\| aiLoading` | כנ"ל +1 | |
| מודל: X סגירה (P:447) + לחיצה על backdrop | `setShowAdvSearch(false)` | |
| מודל: לשוניות "שם" / "פרטי קשר" (P:455,458) | `setAdvTab('basic'\|'details')` | ברירת מחדל `basic` |
| מודל: "נקה הכל" (P:531) | `setAdvFilters({כל 5 שדות ''})` | לא סוגר |
| מודל: "סגור והחל סינון" (P:536) | אם `advAiMode`: `prompt=buildCustomersAiPrompt(advFilters)`; סוגר; אם prompt לא ריק -> `handleAiSearch(prompt)`. אחרת רק סוגר (הסינון כבר חי דרך `advFilters` -> effect) | |

`buildCustomersAiPrompt` (P:18-27): חלקים `בשם {first last}`, `עם טלפון {phone}`, `מהעיר {city}`, `עם דוא"ל {email}` -> `לקוחות {parts.join(', ')}`; ריק אם אין שדות.

### ExportButtons (EB) — props מהעמוד
`data=customers`, `filename="לקוחות"`, `iconOnly`, `onFetchData=fetchCustomersForExport`, `columns`: `id`=`קוד לקוח`; `firstName`=`getLabel('customer_firstName','שם פרטי')`; `lastName`; `phone1`=`getLabel('customer_phone1','טלפון')`; `city`; `email`. (הערה: "קוד לקוח" מיוצא מ-`id` (UUID) ואילו בטבלה מוצג `legacyId` — אי-התאמה קיימת.)
- כפתור פתיחה `data-agy-id=export_open_modal_btn`, title "מערכת הורדה ל-XL ודוחות", `btn btn-secondary btn-icon-only`.
- מודל (פורטל ל-body, `data-agy-id=export_modal_*`): כותרת "מערכת דוחות וייצוא נתונים"; לשוניות "רגיל"/"AI" (רק אם `!hideAi` — `document.body.classList.contains('hide-ai-features')` נקרא ב-mount); שדה `#export-limit-input` "כמות שורות לייצוא:" (default 100, `min=1`, שינוי מאפס `isAdminVerified`); תגים "דורש מנהל" / "אושר מנהל"; כותרת "דוח מיידי מהנתונים (לפי הסינון הקיים):"; כפתורי "ייצוא לאקסל" (`export_excel_btn`), "ייצוא ל-PDF" (`export_pdf_btn`); לשונית AI: כותרת "דוח מותאם אישית באמצעות AI", textarea `export_ai_prompt_textarea` placeholder "הכנס את בקשתך לדוח...", כפתורים "אקסל (AI)" / "PDF (AI)".
- זרימה: `handleActionClick(action)` -> אם `exportLimit>maxRowsWithoutApproval && !isAdminVerified` -> פאנל "נדרש אישור מנהל" (input סיסמה `export_admin_pin_input`, "אישור", "ביטול") ; אחרת `executeAction`.
- `executeAction`: `getExportData()` -> `onFetchData(exportLimit)`; excel -> `downloadRowsAsXlsx(rows,'לקוחות')` (`app/lib/xlsxExport`); pdf -> `window.open` + מסמך A4 עם `window.print()` ואז `window.close()`; AI: `POST /api/ai/report`.

## (ה) קריאות רשת
| # | שיטה + URL | מפתחות | מתי | שימוש בתשובה |
|---|---|---|---|---|
| 1 | `GET /api/customers?{qs}&_t={Date.now()}` (`cache:'no-store'`) P:85 | `page, limit(50), search, sort, order` + אופציונליים (רק אם לא ריקים, בסדר הזה): `firstName, lastName, phone, city, email` | effect (P:114-131) בכל שינוי `page/search/sort/order/advFilters` (וגם `totalPages`); מדולג כש-`isAiModeActive` | `setCustomers(data.data)`, `setTotalPages(data.totalPages\|\|1)`, `setTotalCount(data.total\|\|0)`; שגיאה: `console.error` בלבד |
| 2 | אותה קריאה כ-prefetch (`fetchCustomers(true, page+1)`) | `page+1` | טיימר 1500ms אחרי כל הרצת effect אם `page<totalPages` | כתיבה למטמון בלבד, בלי `setState` / spinner |
| 3 | `POST /api/ai/smart-search` (P:143) | `{prompt, pageContext:'customers', page, whereClause}` | `handleAiSearch`: טקסט AI / מודל מתקדם עם AI / מעבר עמוד ב-AI mode (`whereClause` שנשמר) | `result.data,total,totalPages,page,query,whereClause`; `!res.ok` -> `alert(result.error\|\|'שגיאה בחיפוש החכם')`; חריגה -> `alert('שגיאת תקשורת')` |
| 4 | `GET /api/customers?page=1&limit={exportLimit}&search&sort&order&{adv filters}` (ללא `_t`, P:224-234) | | ייצוא (`fetchCustomersForExport`) | `data.data\|\|[]`; שגיאה -> `[]` |
| 5 | `GET /api/me` (EB) | | mount של `ExportButtons` | `employee.exportMaxRows` |
| 6 | `POST /api/auth/verify-pin` (EB) | `{pin, requiredLevel:'feature:export_over_limit_approval'}` | "אישור" בפאנל מנהל | `success` -> `isAdminVerified=true` והמשך; אחרת `alert(data.error\|\|'סיסמה שגויה או שאין הרשאת מנהל')` |
| 7 | `POST /api/ai/report` (EB) | `{data, prompt, columns:[labels], format:'excel'\|'pdf'}` | "אקסל/PDF (AI)" | `processedData` (HTML ל-PDF / שורות ל-excel) |
| 8 | `POST /api/ai/statistics`, `POST /api/ai/sessions` (SM) | ראו (ו) | שליחת הודעה במודל סטטיסטיקה | |
| 9 | `GET /api/settings/labels` דרך `fetchSharedJson` (`LabelsContext`, `TTL.STATIC`) | | provider גלובלי | `getLabel(key, default)` |

**מטמון**: `cacheNamespace('customers')` (`pageCache.js`; SWR; מפתח = `queryParams.toString()` לפני `_t`; תקרה 300 ערכים גלובלית; ללא TTL). ב-`fetchCustomers` לא-prefetch: אם `has(key)` -> הצגה מיידית + `loading=false`, ואז רענון ברקע שכותב שוב. `prefetchRoutes.js:230` מחמם את `customers` בברירות מחדל (`page=1,limit=50,sort=legacyId,order=desc`). תוצאות AI לא נכנסות למטמון.

## (ו) מודלים / פופאפים / הודעות
- מודל חיפוש מתקדם (P:439): `.modal-backdrop` + `.modal`, סגירה בלחיצה מחוץ.
- `StatisticsModal` (SM): פורטל ל-body, `zIndex 1100`; עם `position` — ממוקם ב-(x-300, y) מוגבל למסך. כותרת "סטטיסטיקות מתקדמות AI". כפתורי כותרת: היסטוריה, חדש (שומר שיחה נוכחית), מחק (`window.customConfirm('האם אתה בטוח שברצונך למחוק את השיחה הנוכחית?')`), סגירה. הודעת פתיחה `getGreeting()` (`customers` -> "הלקוחות"). קלט "שאל שאלה על הנתונים..." + שליחה (title "שליחה"). `POST /api/ai/statistics` body `{prompt, history:[{role,content}], contextQuery: aiQueryUsed, pageContext:'customers'}` -> `data.response`, `data.data` (שורות -> `ResultTable` עד 100 + "הורדה לאקסל (XLSX)" + "CSV"; שגיאת XLSX: alert 'לא הצלחתי ליצור את קובץ האקסל. אפשר להוריד CSV במקום.'); שגיאה: "מצטער, חלה שגיאה בהפקת הסטטיסטיקה." / "שגיאת תקשורת עם השרת."; אחרי כל תשובה `POST /api/ai/sessions` body `{sessionId, context:'דוח AI - customers', messages}`. localStorage `ai_statistics_chat_sessions_customers` (עד 10). היסטוריה: "היסטוריית שיחות", "שיחה נוכחית (פעילה)", "אין היסטוריית שיחות שמורה.", "שיחה ריקה". טעינה: "מנתח נתונים...".
- `alert` ב-EB: 'אנא אפשר חלונות קופצים (Popups) עבור אתר זה כדי להדפיס.', 'שגיאה בשליפת הנתונים', 'אנא פרט כיצד תרצה שה-AI יארגן את הנתונים.', 'אירעה שגיאה בעיבוד הנתונים מול ה-AI. נסה שוב.', 'נא להזין סיסמת מנהל', 'שגיאה באימות מנהל'.
- אין toast.

## (ז) מצבים מיוחדים
- טעינה ראשונה: `.loading-inline` "טוען נתונים..." רק כשאין נתונים (cache hit -> מציג מיד).
- ריק: אין empty-state — טבלה עם thead ו"סה"כ שורות מוצגות: 0".
- שגיאה: `console.error` בלבד (שקט).
- AI mode (`isAiModeActive`): ה-effect הרגיל מושבת (guard P:120), עימוד דרך `handleAiPageChange` עם `whereClause`; חיפוש רגיל/ניקוי מחזיר למצב רגיל; שינוי `advFilters` לא מחזיר.
- `.ai-feature-element` (checkbox במודל, לשונית AI ב-EB) מוסתר כש-`hide-ai-features` על body. כפתורי הכוכב בסרגל ו"שאלות סטטיסטיקה" **לא** עטופים — מוצגים תמיד.
- עימוד מוצג רק כש-`totalPages>1`.
- `legacyId` ריק -> "חדש" (`cell-muted`); `email` ריק -> `-`.
- תוויות `getLabel`: `customer_firstName, customer_lastName, customer_phone1, customer_city, customer_email` (`/api/settings/labels`). ב-modal ברירת המחדל של `customer_city` היא `עיר מגורים`, בטבלה/ייצוא `עיר`.
- אין SystemSetting ישיר בעמוד.

## (ח) URL / אחסון
- `?search=` (P:103-112): נקרא פעם אחת ב-mount ומאכלס `search`+`searchInput`. העמוד לא כותב ל-URL.
- localStorage: `ai_statistics_chat_sessions_customers` (SM). אין sessionStorage.

## (ט) הדפסה / ייצוא / AI
- XLSX, PDF (חלון הדפסה עצמאי, צבעים סטטיים — לא משתני ערכת נושא), ייצוא AI (`/api/ai/report`), חיפוש חכם (`/api/ai/smart-search`), שאלות סטטיסטיקה, CSV/XLSX בתוך `StatisticsModal`.

## (י) מלל (מלאי)
ניהול לקוחות · סה"כ רשומות · חיפוש מתקדם · לקוח חדש · חיפוש · חפש בחכמה · מייצר שאילתה... · ניקוי חיפוש · נקה · חיפוש חכם (AI) · שאלות סטטיסטיקה · טוען נתונים... · קוד לקוח · שם פרטי · שם משפחה · טלפון · עיר · דוא"ל · חדש · סה"כ שורות מוצגות · הקודם · הבא · עמוד · מתוך · חיפוש מתקדם (לקוחות) · שם · פרטי קשר · עיר מגורים · חפש עם AI על השדות שמולאו · נקה הכל · סגור והחל סינון · סגירה.

## (יא) הערות סיכון
1. ה-guard `if (isAiModeActive) return;` (P:120) — בלעדיו תוצאות AI נדרסות (באג מתועד).
2. סדר הפרמטרים ב-`buildCustomersListParams` = מפתח המטמון; שינוי שובר את warm של `prefetchRoutes`. `_t` נוסף רק אחרי חישוב המפתח.
3. `handleSort` לא מאפס עמוד.
4. prefetch של עמוד+1 בטיימר 1500ms — לשמר.
5. כל כותרות העמודות עוברות `getLabel` — לא להקשיח.
6. עמודת "קוד לקוח" בייצוא = `id` ולא `legacyId` — לא לשנות בשקט.
7. `advFilters` חיים מיד (אין כפתור "החל"); "סגור והחל סינון" רק סוגר כשה-AI כבוי.
8. `ExportButtons` ו-`StatisticsModal` משותפים לעמודים אחרים — שינוי עיצובי משפיע על כולם; לשמר `data-agy-id`.
9. `window.customConfirm`/`customAuthPrompt` מוזרקים מ-`PopupProvider` (גלובלי).
10. שורות הטבלה נלחצות בשלמותן (`onClick` על `tr`) — לשמר גם בעיצוב כרטיס/שורה מורחבת.
