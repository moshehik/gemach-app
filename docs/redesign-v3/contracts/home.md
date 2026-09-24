# חוזה עמוד: דף הבית (`/`)

קובץ: `app/page.js` (728 שורות, `'use client'`, קומפוננטה `HomeDashboard`). רכיבים מיובאים: `app/components/SettingQuickPanel.js`, `app/components/CopyableText.js` (`CopyChip`, `splitCopyable`, `renderCopyable`), `app/lib/pageCache.js` (`fetchJson`, `getSettingsCached`). אין `layout.js` מקומי לעמוד.

## א. מטרה והרשאות
- עמוד הכניסה: שורת חיפוש גלובלי (לקוחות/הזמנות/השכרות), חיפוש חכם AI עם צ'אט המשך, קיצורי דרך. כותרת ברוכים-הבאים ניתנת להגדרה.
- הרשאה: `page:home` (`lib/permissionsMetadata.js:161`) - `enforced:false`, פתוח לכל עובד מחובר, ללא בדיקת תפקיד.
- שרת: `/api/global-search` דורש `checkAuth()` (401 אחרת - `app/api/global-search/route.js:8`).
- קיצורי-דרך מוגבלים בקוד הלקוח (`page.js:36-41`): `headManagement` (roleId 0 או 2) ל-`/dashboard`, `/dashboard/pricelist`, `/employees/report`; `messagingEnabled` ל-`/messages`.

## ב. אזורים לפי סדר
1. מעטפת עמודה (`page.js:366-375`): `paddingTop` = `16vh` במצב התחלתי (`isInitialState = !searchResults && aiMessages.length===0`, שורה 363) אחרת `4px`; `paddingBottom` 110px כשיש הודעות AI אחרת 20px; `minHeight:70vh`; flex column; transition `padding-top .4s`.
2. כותרת + כרטיס חיפוש (378-433): `<h1>{welcomeTitle}</h1>` + טופס (אחד משני מצבים).
3. קישורים מהירים (436-448) - רק במצב התחלתי.
4. אזור תשובת AI (451-547) - כשיש `aiMessages`.
5. שורת קלט צפה לשאלת המשך (550-569) - כשיש `aiMessages`, `position:fixed` תחתון-מרכז, z-index 1000.
6. תוצאות חיפוש גלובלי (572-686) - `searchResults && aiMessages.length===0`: 3 כרטיסים בגריד (`minmax(280px,1fr)`, gap 18): לקוחות / הזמנות / השכרות.
7. תחתית: כפתור "מדיניות פרטיות" (689-693) (`marginTop:auto`).
8. חלונית מדיניות פרטיות (696-720, portal) + `SettingQuickPanel` (722-724).

## ג. שדות
| תווית/placeholder | state | פרטים |
|---|---|---|
| חיפוש רגיל: placeholder `דוגמא משפחת כהן...` (412-418) | `searchInput` / `setSearchInput` | text, `disabled={loadingSearch}`; ללא required; `performGlobalSearch` מתעלם מערך ריק/רווחים בלבד (185) |
| חיפוש AI: placeholder `בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')...` (386-392) | `aiInputText` | text, `disabled={aiLoading}`; submit מתעלם מריק (`handleAiInputSubmit` 357-361) |
| שאלת המשך: placeholder `שאל שאלת המשך ל-AI...` (552-561) | `aiReplyInput` | class `input`; Enter (`onKeyDown`, 556) שולח אם `!aiLoading`; `disabled={aiLoading}` |
- מצב `aiInputMode` (bool): מחליף בין שני הטפסים; ההחלפה (`toggleAiInputMode` 348-355) מעתיקה את הטקסט בין `searchInput`<->`aiInputText`.
- `showMoreCustomers/Orders/Rentals` (bool) - הרחבת רשימות מעל 5.
- `showPrivacyPolicy`, `openSettingKey` (string|null), `copiedAiIdx` (int|null, 1500ms).
- `recentSearches` (מערך עד 5) - נשמר ב-localStorage אך **לא מוצג בשום מקום ב-UI** (state בלבד, נכתב 198-200; נקרא 242-245).
- `quickLinkFlags {headManagement:false, messagingEnabled:false}` (fail-closed), `welcomeTitle` (ברירת מחדל `ברוכים הבאים למערכת ניהול הגמ"ח`).

## ד. כפתורים ופעולות
| תווית | handler | מה קורה |
|---|---|---|
| חיפוש (submit, 428) | `handleGlobalSearch` -> `performGlobalSearch(searchInput)` | ראו ה |
| נקה חיפוש (X, 421; מוצג כש-`searchInput && !loadingSearch`) | `clearSearch` (301-308) | מאפס input, results, aiMessages; מוחק `localStorage.dashboardAiMessages`, `sessionStorage.dashboardSearchInput`, `dashboardSearchResults` |
| חיפוש חכם AI (כוכב, 399/425) | `toggleAiInputMode` | מעבר מצב; במצב AI הכפתור צבוע `--primary-solid` על `--primary-tint` |
| נקה (X במצב AI, 395; רק כש-`aiInputText && !aiLoading`) | inline | `setAiInputText('')` |
| חפש בחכמה (submit, 402) | `handleAiInputSubmit` -> `handleAiSearch(text,false)` | טקסט משתנה ל-`מייצר שאילתה...` בזמן `aiLoading` |
| קישור מהיר (Link, 441) | Next `Link` | ניווט ל-`link.href` |
| נקה צ'אט (X, 458) / סגור צ'אט (566) | `clearAiChat` (310-313) | מאפס `aiMessages`, מוחק `localStorage.dashboardAiMessages` |
| העתק (בבועה, 468) | `copyBubbleText(idx, msg.content)` | `navigator.clipboard.writeText` (המקור הגולמי כולל תגיות `[OPEN_SETTING:..]`), אייקון check 1.5s; כשל נבלע |
| פתח הגדרה (480; לכל מפתח מ-`[OPEN_SETTING:key]`) | `setOpenSettingKey(key)` | פותח `SettingQuickPanel` |
| הורד Excel (494; כש-`msg.data.length>0`) | `exportTableToExcel(msg.data,'AI_Export')` (315-329) | `import('xlsx')` דינמי; מסיר עמודות `_action*`; גליון `נתונים`; קובץ `AI_Export.xlsx` |
| כפתור פעולה בטבלת AI (517) | `Link href=row._actionUrl` | תווית `row._actionLabel`; עמודת "פעולות" מופיעה אם לפחות שורה אחת עם `_actionUrl` |
| שלח (562) | `handleAiSearch(aiReplyInput,true)` | `disabled` אם `aiLoading || !aiReplyInput.trim()`; אייקון `i-chevron-start` |
| הצג עוד / הצג פחות (597/638/671) | toggles | מוצג רק כש->5 תוצאות; ברירת מחדל 5 ראשונות |
| שורת תוצאה (לקוח/הזמנה/השכרה) | `Link` | לקוח -> `/customers/${c.id}`; הזמנה -> `/orders/${o.orderId}`; השכרה -> `/orders/${r.orderId}` |
| תגית הזמנה/לקוח בטקסט AI | `<a class="chip">` + `navigateInApp` (119-123) | regex `הזמנה\s*\d+` -> `/orders/N`; `לקוח\s*[\w-]+` -> `/customers/X`; `router.push` בלחיצה רגילה, נשמר ctrl/cmd/shift/alt/middle-click (טאב חדש) |
| תגית העתקה (`CopyChip`) בטקסט/תאי טבלה | `writeClipboard` | אימייל/טלפון ישראלי; fallback ל-`execCommand('copy')`; `stopPropagation`; tooltip `לחץ להעתקה`/`הועתק`; direction ltr |
| מדיניות פרטיות (690) / סגירה (701) / הבנתי (715) / לחיצה על backdrop (697) | `setShowPrivacyPolicy` | ראו ו |

## ה. קריאות רשת
| # | קריאה | טריגר | שימוש בתגובה | מטמון |
|---|---|---|---|---|
| 1 | `GET /api/me` דרך `fetchJson` (86) | mount (`useEffect` 84-104), `.catch -> {success:false}` | `me.success && me.employee.roleId` (0 או 2 = הנהלה ראשית) | `fetchJson` בלבד - dedupe של GET מקביל, ללא מטמון |
| 2 | `getSettingsCached()` = `fetchSharedJson('/api/settings',{ttl:TTL.STATIC})` (87) | mount, `.catch -> []` | מפתחות: `require_login`, `hide_internal_messaging`, `home_welcome_title` (ערך `'true'` בטקסט) | מטמון משותף `lib/apiCache` SWR; `invalidateSettings()` אחרי שמירה ב-QuickPanel |
| 3 | `GET /api/global-search?q=<encodeURIComponent>` (192) | `performGlobalSearch` (submit או `?q=`) | `{customers[],orders[],rentals[]}`; נשמר ב-state וב-`sessionStorage`. אין בדיקת `res.ok` - תשובת שגיאה `{error}` נשמרת כ-`searchResults` ומציגה 0/0/0 | ללא |
| 4 | `POST /api/ai` JSON `{prompt, context:'User is in the general system home dashboard.', history:[{role,content}] (ללא ההודעה האחרונה)}` (274-282) | `handleAiSearch` | `res.ok`: `{response, data}` -> הודעת `{role:'model',content,data}`; אחרת `שגיאה בחיפוש חכם.`; חריגה `שגיאת תקשורת.` (הודעות שגיאה נוספות ל-state אך **לא** ל-localStorage) | ללא |
| 5 | `SettingQuickPanel`: `GET /api/settings/guide`; `POST /api/settings` `{items:[{key,value,name}]}` (+`employeeId,pin` בניסיון שני אחרי 401) | פתיחת הפאנל / "שמור שינוי" | ראו ו | `invalidateSettings()` אחרי הצלחה |
- תפקידי הודעות ה-AI: `'user'` / `'model'`.
- נתוני `orders` בתוצאות: `orderId,id,firstName,lastName,status,eventDateHebrew,totalAmount,itemCount`; `customers`: `id,firstName,lastName,phone1,city`; `rentals`: `id,orderId,catalogName,description,barcode,catalogBarcode,sizeText`.

## ו. חלוניות / טוסטים
- **מדיניות פרטיות** (696-720): portal ל-`document.body`, `.modal-backdrop` z-index 9999, לחיצה על הרקע סוגרת, `stopPropagation` בתוכן; כותרת `מדיניות פרטיות`; גוף טקסט סטטי זמני (5 פסקאות, כולל `* ניתן לערוך טקסט זה בהמשך בקוד המערכת.`); כפתורים: X (`title=סגירה`), `הבנתי`. maxWidth 600, maxHeight 80vh, גוף `overflowY:auto`.
- **SettingQuickPanel** (`components/SettingQuickPanel.js`), z-index 100001, backdrop blur; רוחב 480. סגירה: X, `סגור`, לחיצה על הרקע. תוכן:
  - טעינה: ספינר + `טוען הגדרה...`; שגיאה: `אין הרשאה לצפות בהגדרות מערכת.` (401) / `שגיאה בטעינת ההגדרה.` / `לא נמצאה הגדרה עם המפתח הזה.`
  - תג `entry.location`, תיאור `entry.description`.
  - עורך לפי `entry.fieldType`: `boolean` (מתג `switch on`, מלל `פעיל`/`כבוי`), `select` (`entry.options`), `multiline` (textarea), `number` (ולידציה `validateNumericSetting` מ-`app/lib/settingsValidation`, גבול אדום + הודעה), קריאה-בלבד ל-`department|mandatoryFields|fieldGroups|secret|timestamp` (input disabled + הסבר, ללא כפתור שמירה), אחרת text.
  - שמירה: ערך מומר ב-`toDisplayValue(entry.key, value)` (`lib/settingsMetadata.js`, הפיכה למפתחות `hide_*`) לפני שליחה. 401 -> `window.customAuthPrompt(msg,'הנהלה ראשית')` -> שליחה חוזרת עם `employeeId`+`pin`; ביטול -> `השמירה בוטלה: נדרש אישור הנהלה ראשית/מתכנת.`; הצלחה `ההגדרה נשמרה בהצלחה.`; כשל `שגיאה בשמירת ההגדרה`.
  - קישור `פתח בעמוד ההגדרות המלא ←` -> `${entry.pagePath}?tab=<category>&highlight=<key>` (ברירת מחדל `/admin/settings`); כפתורים `סגור`, `שמור שינוי` / `שומר...`.
- אין טוסטים/confirm בעמוד עצמו.

## ז. מצבים מיוחדים
- טעינת חיפוש: ספינר במקום אייקון, input disabled; טעינת AI: ספינר רק כש-`aiMessages.length===0`, אחרת אינדיקטור הקלדה (`typing-indicator`) בבועת assistant.
- ריק: `empty-state` לכל כרטיס (`לא נמצאו לקוחות/הזמנות/השכרות`).
- טבלת AI: מציגה עד 15 שורות (`slice(0,15)`) + הערה `מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)`; כותרות עמודות = מפתחות `msg.data[0]`.
- אין מצב offline מפורש; שגיאות חיפוש -> `console.error` בלבד.
- מסונן-הרשאה: קישורי `לוח בקרה/מחירון/דוח נוכחות` (הנהלה ראשית): `me.success ? isHeadManagement : !requireLogin`; `הודעות` נסתר כש-`hide_internal_messaging==='true'`.
- SystemSetting: `home_welcome_title` (כותרת; ריקה -> ברירת מחדל), `hide_internal_messaging`, `require_login`. הבדלי נווה יעקב/גמ"ח ראשי: רק דרך ערכי ההגדרות (אין בדיקת host בעמוד).
- ה-AI עשוי להחזיר `[OPEN_SETTING:key]` (`app/api/ai/route.js`, ACTION SETTINGS_GUIDE); התגיות מוסרות מהתצוגה (`extractOpenSettingKeys` 16-26, regex `[a-zA-Z0-9_]+`).

## ח. URL / אחסון
- URL: `?q=<text>` (מ-TopbarSearch "הצג את כל התוצאות") - מריץ חיפוש מיידי, ואז `history.replaceState(null,'',pathname)`; גובר על מצב שמור (217-229).
- `sessionStorage`: `dashboardSearchInput`, `dashboardSearchResults` (JSON).
- `localStorage`: `dashboardAiMessages` (JSON, נכתב רק בהצלחה/בשליחת משתמש), `dashboardRecentSearches` (JSON, עד 5).
- שחזור בטעינה (231-245): מכל שלושת המפתחות. שים לב: `JSON.parse` ללא try/catch.
- חיפוש רגיל חדש מוחק את `dashboardAiMessages` ומאפס `aiMessages`; חיפוש AI ראשון (לא המשך) מוחק `searchResults` ו-`sessionStorage.dashboardSearchResults`.

## ט. הדפסה / ייצוא / AI
- ייצוא: Excel לטבלת AI (ראו ד). אין הדפסה.
- AI: חיפוש חכם + היסטוריית שיחה + פתיחת הגדרה; תגיות העתקה; קישורי הזמנה/לקוח מתוך טקסט חופשי.

## י. מלל משתמש (מלאי, לשכתוב)
`ברוכים הבאים למערכת ניהול הגמ"ח`; `דוגמא משפחת כהן...`; `בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')...`; כותרות כפתורים: `נקה`, `נקה חיפוש`, `חיפוש חכם (AI)`, `חיפוש`, `חפש בחכמה`, `מייצר שאילתה...`, `העתק`, `פתח הגדרה`, `הורד Excel`, `פעולות`, `שלח`, `סגור צ'אט`, `נקה צ'אט`, `סגירה`; `קישורים מהירים`; קיצורים: `לוח בקרה`, `מחירון`, `דוח נוכחות`, `הודעות`, `שעון נוכחות`; `צ'אט חכם מבוסס AI:`; `שאל שאלת המשך ל-AI...`; `שגיאה בחיפוש חכם.`; `שגיאת תקשורת.`; `תוצאות חיפוש ל: "…"`; `לקוחות (N)`, `הזמנות (N)`, `השכרות (N)`; `קוד: #… | אירוע: …`, `סה"כ: ₪… | פריטים: …`, `ברקוד: … • מידה: …`; `הצג עוד`/`הצג פחות`; `לא נמצאו …`; `מדיניות פרטיות` + טקסט החלונית; `הבנתי`; ברירת מחדל סטטוס `פעיל`; tooltips סטטוס: `הוחזר`(check-circle ירוק), `מושכר`(tag צהוב), `בוטל`(x-circle אדום), `שולם`(check כחול), אחרת `i-clock` אפור.

## יא. Risk notes
- `isInitialState` שולט בו-זמנית ב-padding, בקישורים המהירים ובמעטפת - שינוי מבנה משנה מתי כל אזור מוצג. `aiMessages.length>0` מסתיר את תוצאות החיפוש הרגיל גם אם `searchResults` קיים.
- שורת הקלט הצפה `position:fixed` + `paddingBottom:110px` - חייבים להישאר תואמים כדי שהתוכן לא ייסתר.
- `useEffect` של `?q=` ו-hydration רצים פעם אחת; הסדר `q` קודם-לשחזור-שמור קריטי. `replaceState` חובה למניעת חיפוש חוזר ברענון.
- `performGlobalSearch` סוגר על `recentSearches` (closure) - אל תעבירו ל-hook אחר בלי לשמור על התנהגות.
- `disabled` על input בזמן חיפוש; `spinner` מחליף אייקון - שימו לב לנגישות/RTL של `search-toolbar`.
- אייקונים דרך `<use href="#i-...">` (ספריית SVG sprite גלובלית): `i-search,i-star,i-x,i-check,i-copy,i-settings,i-download,i-chevron-start,i-user,i-bag,i-tag,i-clock,i-check-circle,i-x-circle,i-grid,i-coin,i-activity,i-message`. `i-chevron-start` משמש גם ל"שלח" וגם לחץ שורת תוצאה (RTL).
- צבעי סטטוס/סוג דרך משתני CSS (`--success,--info,--warning,--danger`) - משמעות סמנטית.
- מחלקות קיימות בשימוש (`card, card-pad, list-card, chip, bubble(.user/.assistant), chat-thread, typing-indicator, table-wrap/table-scroll/data, modal*, search-toolbar(-actions), empty-state, section-title, card-title-row, switch`) - אם מוחלפות, יש לשמר `.bubble-copy-btn.copied`.
- `navigateInApp` ו-`CopyChip` (`stopPropagation`) - לוגיקת אירועים שאסור לאבד בסגנון חדש.
- ה-AI מחזיר טבלה ב-`msg.data` עם `_actionUrl/_actionLabel` - להסתיר עמודות `_action*` גם בטבלה וגם ב-Excel.
- אין ולידציית `res.ok` ב-global-search (התנהגות קיימת; לא לשנות ב-R8).
