# חוזה עמוד: /messages — מרכז הודעות

מקורות: `app/messages/page.js` (887 שורות, client component יחיד, ללא תת-רכיבים מקומיים), `app/messages/layout.js` (7 שורות), `app/lib/pageCache.js`.
כל ההפניות `:N` הן לשורות ב-`app/messages/page.js`.

## (א) מטרה והרשאות
- מרכז הודעות פנימיות בין עובדים: דואר נכנס/יוצא/ארכיון, כתיבת הודעה, הודעות "בין משמרות" ו"להנהלה" (שידור לכולם), הגדרת התראות מייל אישית.
- שער גישה: `layout.js:5-7` — `<PageGate pageKey="page:messages">` (קטלוג `lib/permissionsMetadata.js:286`; ברירת מחדל סגור: רק הנהלה ראשית/מתכנת או שורת הרשאה; `defaultForRoleId: () => false`). ה-layout הוא server component ועוטף את הדף — **חייב להישאר**.
- הסתרת קישורים: `hideInternalMessaging` (הגדרה `hide_internal_messaging`) מסתירה קישור ב-UserMenu (`UserMenu.js:197`), פעמון ו-ShiftMessageWatcher (`AppShell.js:141,241`), וכרטיס בדף הבית (`app/page.js:40`). הדף עצמו לא בודק זאת.
- הרשאת "טופל" להודעות הנהלה: `isManagerRole = roleId ∈ {0,1,2}` (`:355`), נאכף גם בשרת (`/api/notifications/handle`, MANAGEMENT_ROLE_IDS).
- מבנה: fragment (`<>`) ללא wrapper; מחלקות גלובליות (`page-head`, `page-desc`, `tabs`/`tab`/`tab active`, `card card-pad`, `badge badge-*`, `btn btn-primary|btn-secondary|btn-sm`, `chip`, `avatar`, `empty-state`, `callout callout-danger|callout-success`, `field`, `input`, `select`, `textarea`, `checkbox-row`, `input-icon-wrap`, `card-title-row`, `page-loading`, `spinner lg`, `hint`, `icon`) ואיקוני sprite `#i-*` (mail, message, folder, refresh, alert-circle, settings, plus, search, user, check, check-circle, tag, x).

## (ב) אזורים וטאבים לפי סדר
1. מצב טעינה (מסך מלא) `:338-345`.
2. `page-head` (`:567-572`): h1 "מרכז הודעות" + `page-desc`.
3. סרגל טאבים (`:574-612`) — סדר: נכנסות · יוצאות · ארכיון · [בין משמרות — מותנה] · [להנהלה — מותנה] · הגדרות · הודעה חדשה. `activeTab` ברירת מחדל `'incoming'`; ערכים: `incoming|outgoing|archived|shift|management|settings|compose`.
4. פאנל פעיל אחד בלבד (רינדור מותנה): incoming `:615`, outgoing `:642`, shift `:669`, management `:705`, archived `:741`, compose `:768`, settings `:843`. (סדר ה-JSX שונה מסדר הטאבים — לא משפיע.)

| טאב | איקון | תג ספירה |
|---|---|---|
| נכנסות `title="דואר נכנס"` | `#i-mail` | `badge-danger` = `incoming.filter(!isRead).length` (אם >0) |
| יוצאות `title="דואר יוצא"` | `#i-message` | `badge-neutral` = `outgoing.length` (אם >0) |
| ארכיון `title="ארכיון הודעות"` | `#i-folder` | `badge-neutral` = `archived.length` (אם >0) |
| בין משמרות `title="הודעות בין משמרות"` | `#i-refresh` | `badge-danger` = shiftHandoverNotes שלא נקראו (אם >0) |
| להנהלה `title="הודעות להנהלה"` | `#i-alert-circle` | `badge-warning` = managementNotes ללא `handledAt` (אם >0) |
| הגדרות `title="הגדרות התראות"` | `#i-settings` | — |
| הודעה חדשה `title="הודעה חדשה"` | `#i-plus` | — |

לכפתורי הטאב `tabResetStyle` (`:349`) שמאפס סגנון native של button — לשמור אלמנט button.

### פאנלי רשימה (נכנסות / יוצאות / ארכיון)
- h2 (`paneTitleStyle`): "דואר נכנס" / "דואר יוצא" / "ארכיון הודעות".
- שורת חיפוש (זהה בשלושה; **אותו state `searchTerm` משותף בין הטאבים**), `input-icon-wrap` maxWidth 420, איקון `#i-search`.
- ריק: `empty-state` עם איקון (mail/message/folder) והודעה תלוית-חיפוש.
- רשימה: עמודה, gap 12px, `renderMessageCard(notif, type)`; בארכיון `type = notif.direction || 'incoming'`.

### כרטיס הודעה `renderMessageCard` (`:491-546`)
- רקע/מסגרת `var(--primary-tint)` / `var(--primary)` כש-`isUnread` (= `type==='incoming' && !notif.isRead`).
- `isBroadcast = notif.receiverId === null` → אווטאר בצבע warning + תג `badge-warning` "הודעה לכולם".
- אווטאר: outgoing = `#i-user`; אחרת האות הראשונה של `sender.firstName` או 'מ' (`notif.sender.firstName.charAt(0)` ללא הגנה מ-null).
- h3: outgoing = `אל: {כל העובדים | שם מקבל | לא ידוע}`; אחרת שם שולח או 'מערכת הגמ"ח'.
- תאריך: `new Date(notif.createdAt).toLocaleString('he-IL')` (class `hint`).
- תוכן: `<p>` עם `whiteSpace: pre-wrap`.
- כפתורים (`marginInlineStart:auto`): "סמן כנקרא" (רק isUnread); "ארכיון" (`#i-folder`) / "שחזר" (`#i-refresh`) לפי `notif.isArchived`.
- אזור תגיות אישיות `renderTags` (`:444-489`): איקון `#i-tag`, chip לכל תגית עם כפתור ✕, chip קלט + כפתור `#i-plus`.

### פאנל "בין משמרות" (`:669-702`, רק כש-`shiftHandoverEnabled`)
כרטיס הזנה (maxWidth 560) + `renderShiftNoteCard` (`:359-404`): אווטאר (אות ראשונה של `formatNoteAuthor` או 'מ'), שם, תאריך, תג "אושרה קריאה" (success) או כפתור "אשר קריאה"; תג "טופל" (success, `title`="טופל ע"י ..." כש-`handledBy`) או "ממתין לטיפול" (warning); כפתור "סמן כטופל"/"בטל טופל" **לכל עובד**. כרטיס שלא נקרא = רקע primary-tint.

### פאנל "להנהלה" (`:705-738`, רק כש-`managementMessagesEnabled`)
כרטיס הזנה + `renderManagementNoteCard` (`:406-442`): כמו לעיל, בלי "אשר קריאה"; רקע warning-tint/border warning כשלא טופל; כפתור טופל/בטל טופל **רק אם `isManagerRole`**.

### פאנל "הודעה חדשה" (`:768-840`)
h2; callout שגיאה (`error`) ו-callout הצלחה (`sendSuccess`) מעל הכרטיס; כרטיס maxWidth 560: select נמען, textarea תוכן, checkbox מייל, כפתור שליחה מיושר לקצה.

### פאנל "הגדרות" (`:843-884`)
h2; כרטיס: `card-title-row` (איקון mail + h3 "התראות במייל"); אם `currentUser`: שורת מייל (`<strong dir="ltr">`) או אזהרה אדומה אם אין מייל + checkbox + "שומר שינויים..." בזמן שמירה; אחרת "טוען נתוני עובד...".

## (ג) שדות / קלטים
| שדה | תווית / placeholder | state | ולידציה | פורמט |
|---|---|---|---|---|
| חיפוש (3 מופעים `:618,645,744`) | placeholder "חיפוש בהודעות (תוכן, שולח, תגית)..." | `searchTerm` | אין; סינון מקומי: `trim().toLowerCase()`, haystack = content + שם שולח + שם מקבל + personalTags, `includes` (`:548-558`) | טקסט |
| נמען | label "שלח אל:" `#messages-receiver` | `receiverId` (ברירת מחדל `'all'`) | אין. ראשון value `all` "כל העובדים במערכת (הודעה כללית)", ואז `employees` (value=`emp.id`, טקסט `firstName lastName`); ללא סינון isActive בצד לקוח | select |
| תוכן הודעה | label "תוכן ההודעה:" `#messages-content`, placeholder "הקלד את הודעתך כאן..." minHeight 150 | `content` | חובה: `!content.trim()` → `setError('יש להזין תוכן להודעה')` וחזרה (`:281-284`). נשלח **בלי trim** | textarea |
| שליחה גם במייל | label "שלח התראה גם למייל (לעובדים בעלי כתובת מייל מעודכנת)" `#messages-send-email` | `sendEmail` (false) | אין | checkbox. נשלח בגוף אך השרת מתעלם ותמיד מנסה מייל למי ש-`receiveEmailAlerts` (`api/notifications/route.js:~150-168`) — לשמר בגוף |
| הודעת משמרת | label "הודעה חדשה למשמרת הבאה:" `#shift-note-content`, placeholder "לדוגמה: 3 שמלות בייבוש, אין להשכיר מידה 40 עד שיתייבשו..." minHeight 90 | `shiftNoteText` | כפתור disabled אם ריק/רווחים או בשליחה | textarea |
| הודעה להנהלה | label "הודעה/שאלה חדשה להנהלה:" `#management-note-content`, placeholder "לדוגמה: לקוחה X התלוננה על Y / שאלת מדיניות..." | `managementNoteText` | כנ"ל | textarea |
| תגית חדשה (לכל כרטיס `:465-477`) | placeholder "הוסף תגית..." | `tagInputs[notif.id]` (map לפי id) | ריק/רווחים נבלע; כפילות (אחרי trim) לא נשלחת אך הקלט מתנקה; Enter = `preventDefault` + הוספה | text, רוחב 70px |
| קבל התראות למייל | label "קבל התראות למייל על הודעות חדשות" `#messages-receive-alerts` | `currentUser.receiveEmailAlerts` (controlled מ-currentUser) | `disabled` אם `isSavingSettings` או אין `currentUser.email`; שמירה מיידית ב-onChange | checkbox |

## (ד) כפתורים ופעולות
| תווית | handler | קורא ל |
|---|---|---|
| 7 טאבים | `setActiveTab(...)` `:575-608` | מקומי |
| סמן כנקרא / אשר קריאה | `markAsRead(id)` `:137` | POST `/api/notifications/read` |
| ארכיון / שחזר | `handleArchive(id, bool)` `:231` | POST `/api/notifications/archive` |
| ✕ (`title="הסר תגית"`) | `removeTag` `:275` → `handleUpdateTags` `:247` | POST `/api/notifications/tags` |
| + (`title="שמור תגית"`) / Enter | `addTag` `:266` → `handleUpdateTags` | POST `/api/notifications/tags` |
| הוסף הודעה (משמרת) | `handleSendShiftNote` `:159` | POST `/api/notifications` |
| שלח להנהלה | `handleSendManagementNote` `:184` | POST `/api/notifications` |
| סמן כטופל / בטל טופל | `handleToggleHandled(id, !isHandled)` `:210` | POST `/api/notifications/handle` |
| שלח הודעה (`title="שלח הודעה"`) | `handleSend` `:280` | POST `/api/notifications` |
| checkbox התראות מייל | `handleSaveSettings(checked)` `:318` | PATCH `/api/me` |

בזמן שליחה טקסט הכפתור "שולח..." (מחליף גם את האיקון).

## (ה) קריאות רשת
כל ה-fetch עם `Content-Type: application/json`; אימות בעוגיה בלבד.

**טעינה (`fetchData` `:105-131`; ב-mount `:133`; וגם אחרי פעולות)** — `Promise.all` של 4 GET דרך `fetchJson` (מאחד GET מקבילים לאותו URL), כולן `{cache:'no-store'}`:
1. `/api/notifications` → `{success, notifications[], outgoing[]}`; פריט: `id, senderId, receiverId, title, content, category, isRead, isArchived, createdAt, sender{firstName,lastName}, receiver{...}, personalTags[], handledAt, handledBy{firstName,lastName}`.
2. `/api/employees` → מערך, או `{success, employees}` (שני הפורמטים נתמכים `:98-102`).
3. `/api/me` → `{success, employee{email, receiveEmailAlerts, roleId,...}}` → `currentUser`.
4. `/api/settings` → מערך `{key,value}`; `shift_handover_notes` ו-`management_messages` פעילים כש-`value === 'true'` בדיוק (`:60-61`). נקרא ישירות עם `fetchJson`, לא דרך `getSettingsCached`.
כשל (throw) → `setError('שגיאה בטעינת נתונים')`.

**מוטציות:**
| trigger | קריאה | גוף | שימוש בתשובה | מטמון |
|---|---|---|---|---|
| markAsRead | POST `/api/notifications/read` | `{notificationId}` | אם `res.ok`: `isRead:true` מקומי ב-incoming+shift+management | `messagesCache.delete('all')` |
| handleSendShiftNote | POST `/api/notifications` | `{receiverId:'all', title:'הודעת משמרת', content, category:'shift_handover'}` | `res.ok && data.success`: ניקוי טקסט + `fetchData()`; אחרת `setError(data.error \|\| 'שגיאה בשליחת ההודעה')`; catch `'שגיאת תקשורת'` | delete לפני fetchData |
| handleSendManagementNote | POST `/api/notifications` | `{receiverId:'all', title:'הודעה להנהלה', content, category:'management'}` | כנ"ל | כנ"ל |
| handleToggleHandled | POST `/api/notifications/handle` | `{notificationId, handled}` | מעדכן `handledAt`,`handledBy` מ-`data.notification` ב-management+shift; שגיאה `'שגיאה בעדכון סטטוס טיפול'` / 'שגיאת תקשורת' | delete |
| handleArchive | POST `/api/notifications/archive` | `{notificationId, archive}` | אם ok: `fetchData()`; שגיאה נבלעת (console) | ללא delete מפורש |
| handleUpdateTags | POST `/api/notifications/tags` | `{notificationId, tags}` | ok: `personalTags` מקומי ב-incoming/outgoing/archived (לא shift/management) | delete |
| handleSend | POST `/api/notifications` | `{receiverId, title:'הודעה חדשה', content, sendEmail}` | הצלחה: `setContent('')`, `setReceiverId('all')`, `sendSuccess` ל-3 שניות (`setTimeout`), `fetchData()`, **`setActiveTab('outgoing')`**; כשל `setError(data.error \|\| 'שגיאה בשליחת הודעה')` | ללא delete מפורש |
| handleSaveSettings | PATCH `/api/me` | `{receiveEmailAlerts}` | ok: `setCurrentUser(data.employee)` | delete |

שרת `POST /api/notifications`: דורש `content` (400); category מסווג דורש הגדרה מופעלת (403 `'התכונה כבויה בהגדרות המערכת'`) ומכריח `receiverId=null`.

**מטמון:** `cacheNamespace('messages')` מ-`app/lib/pageCache.js`, מפתח `'all'`, ערך `{notifData, empData, meData, settingsData}`; SWR: אם קיים — `applyData` מיידי + `setLoading(false)` ורענון שקט ברקע; אין TTL (LRU בגודל MAX_ENTRIES). אין שימוש ישיר ב-`apiCache`/prefetch בדף.

## (ו) חלוניות / טוסטים / אישורים
- **אין** modal, confirm, alert או toast בדף. משוב רק דרך `callout-danger` (`error`) ו-`callout-success` "ההודעה נשלחה בהצלחה!" בטאב compose, ו-`title` (tooltip native) על תג "טופל".
- פעמון / ShiftMessageWatcher בלבד ב-`AppShell` — מחוץ לדף.

## (ז) מצבים מיוחדים
- **טעינה:** `loading` רק בטעינה ראשונה בלי מטמון → `.page-loading` + `.spinner.lg`. עם מטמון אין מסך טעינה.
- **ריק:** נכנסות "תיבת הדואר הנכנס ריקה" / (חיפוש) "לא נמצאו הודעות תואמות לחיפוש"; יוצאות "לא שלחת הודעות עדיין"; ארכיון "אין הודעות בארכיון"; משמרות "אין הודעות בין משמרות כרגע"; הנהלה "אין הודעות להנהלה כרגע". ההבחנה לפי אורך הרשימה הלא-מסוננת.
- **שגיאה:** state `error` יחיד; מוצג **רק** בפאנל compose. שגיאות משמרת/הנהלה/טופל/טעינה לא נראות בטאבים שלהם; `error` מתאפס רק ב-`handleSend` (שגיאה ישנה תופיע שוב בכניסה ל-compose).
- **Offline:** אין טיפול ייעודי, רק catch.
- **הרשאה:** `isManagerRole` מסתיר כפתור "טופל" בהנהלה; שער דף ב-layout.
- **SystemSetting:** `shift_handover_notes`, `management_messages` (קטגוריית "הודעות", `lib/settingsMetadata.js:410`) — שולטות בטאבים ובתנאי הפאנל (אם נכבה בזמן שהטאב פעיל לא מוצג דבר), ונאכפות גם בשרת. ערך נקבע לכל ארגון (גמ"ח ראשי / נווה יעקב) ב-DB שלו; הדף לא מבחין בארגון. `hide_internal_messaging` משפיע רק על גישה לדף (ראו א).
- **סיווג נתונים (`applyData` `:64-97`):** הודעות `category` shift_handover/management מסוננות מהרגילות ומוצגות רק בטאבים ייעודיים (תמיד מגיעות ב-`notifications`, לא ב-`outgoing`); ארכיון = incoming+outgoing עם `isArchived` (מקבלות `direction`), ממוין `createdAt` יורד. הודעות משמרת/הנהלה אינן ניתנות לארכוב ואין להן תגיות.
- `currentUser` בלי מייל: אזהרה אדומה "לא מוגדרת עבורך כתובת מייל..." וה-checkbox disabled.

## (ח) URL / storage
- אין query params, אין router/`useSearchParams`, אין localStorage/sessionStorage. הטאב הפעיל לא נשמר (אחרי רענון תמיד `incoming`). מטמון SWR בזיכרון (module-level).
- כניסות לדף: `UserMenu` (`router.push('/messages')`), כרטיס בדף הבית, פעמון.

## (ט) הדפסה / ייצוא / AI
- אין.

## (י) מלל משתמש (מלאי — לכתיבה מחדש, לא להעתקה)
- כותרות: מרכז הודעות; "נהל את ההתראות וההודעות הפנימיות שלך"; דואר נכנס; דואר יוצא; ארכיון הודעות; הודעות בין משמרות; הודעות להנהלה; כתיבת הודעה חדשה; הגדרות התראות; התראות במייל.
- טאבים: נכנסות, יוצאות, ארכיון, בין משמרות, להנהלה, הגדרות, הודעה חדשה (+ title attrs שבטבלה).
- כרטיס: אל: / כל העובדים / לא ידוע / מערכת הגמ"ח / הודעה לכולם / סמן כנקרא / העבר לארכיון (title) / ארכיון / החזר מארכיון (title) / שחזר / הסר תגית / שמור תגית / הוסף תגית... / אושרה קריאה / אשר קריאה / טופל / טופל ע"י X (title) / ממתין לטיפול / סמן כטופל / בטל סימון טופל (title) / בטל טופל.
- טפסים: כל התוויות וה-placeholders שבסעיף ג; "הוסף הודעה", "שלח להנהלה", "שלח הודעה", "שולח...".
- מצבים: טוען הודעות..., ההודעה נשלחה בהצלחה!, יש להזין תוכן להודעה, שגיאה בטעינת נתונים, שגיאה בשליחת ההודעה, שגיאה בשליחת הודעה, שגיאת תקשורת, שגיאה בעדכון סטטוס טיפול, כל מחרוזות ה-empty, "המייל המעודכן שלך במערכת הוא:", "לא מוגדרת עבורך כתובת מייל במערכת. אנא פנה למנהל לעדכון המייל.", "שומר שינויים...", "טוען נתוני עובד...".
- **מחרוזות שנשלחות לשרת ונשמרות (לא UI, אסור לשנות):** title `'הודעת משמרת'`, `'הודעה להנהלה'`, `'הודעה חדשה'` (`:166,191,295`); value `'all'`; category `'shift_handover'`/`'management'`.

## (יא) הערות סיכון
1. **פרמטר `type` ב-`renderMessageCard`** (`incoming|outgoing`) קובע אווטאר, כותרת "אל:" וכפתור "סמן כנקרא". בארכיון `type = notif.direction` — חייב לשרוד.
2. **`searchTerm` משותף** בין 3 טאבים — לא לפצל.
3. **`error` יחיד מוצג רק ב-compose.** טוסט גלובלי ברסטייל = שינוי התנהגות; לפחות לשמר callout ב-compose ואת אי-האיפוס במעבר טאב (או לתעד החלטה).
4. **`handleSend` מעביר אוטומטית ל-`outgoing`** ו-`sendSuccess` (3s) כמעט ולא נראה כי הוא מוצג רק ב-compose. לא להסיר `setActiveTab('outgoing')`.
5. **Checkbox הגדרות controlled מ-`currentUser` ושומר ב-onChange** — אין כפתור שמירה; אל להפוך לטופס.
6. **מטמון SWR:** ההבדל בין עדכון מקומי + `messagesCache.delete` (read/tags/handle/settings) לבין `fetchData` (archive/send) חייב להישמר.
7. עדכון תגיות לא מעדכן shift/management; `tagInputs` ממופתח לפי id; הקלט מתנקה גם בכפילות.
8. **`isManagerRole` ([0,1,2])** היא לוגיקת הרשאה, לא רק תצוגה; הבחנה הנהלה (מנהלים) מול משמרות (כולם).
9. בדיקת `=== 'true'` מדויקת בהגדרות.
10. **סגנון inline נושא משמעות:** רקע primary-tint = לא-נקרא, warning-tint/border = הנהלה שלא טופלה, אווטאר warning = broadcast. יש להמיר למחלקות מצב v3 ולא לאבד. `tabResetStyle` נדרש כי הטאבים הם `<button>`.
11. `white-space: pre-wrap` בתוכן, `dir="ltr"` על כתובת המייל בהגדרות — RTL/bdi.
12. מספרי תגי הטאבים מחושבים מ-state לא מסונן (לא מושפעים מחיפוש) — לשמר.
13. `fetchJson` מאחד GET מקבילים — לא להחליף ב-`fetch` ישיר.
14. חוסרי עקביות קיימים שלא לתקן ברסטייל: `sendEmail` מתעלמים בשרת; `sender.firstName.charAt(0)` ללא הגנה; ארכוב/שליחה בלי `delete` מפורש.
15. שמירת `id`/`htmlFor` של: `messages-receiver`, `messages-content`, `messages-send-email`, `shift-note-content`, `management-note-content`, `messages-receive-alerts`.
