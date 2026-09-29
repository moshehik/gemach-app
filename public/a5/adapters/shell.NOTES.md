# shell.js — סרגל אתר עליון, חיפוש, פעמון, משמרת, תפריט משתמש, תחתית, פס הודעות

נטען אחרי `core.js`. תלוי ב-`/api/a5/boot` (נלקח מ-`A5.boot` אם כבר נטען), `/api/me`, `/api/settings`, `/api/global-search`, `/api/notifications*`, `/api/orders/overdue`, `/api/logout`.
לפני כל שימוש: `await A5.shell.init()` (טוען boot + משתמש + הגדרות חסרות). אומת בקריאות GET מול השרת (נווה יעקב, משתמשת הנהלה ראשית).

## (א) מה מחובר
| אזור | API / מקור | פונקציה |
|---|---|---|
| ניווט | `navGroups` מ-boot (אותו סינון הרשאות כמו התפריט הצדדי) + כתובות קבועות לפריטים שאינם ב-navGroups, עם הכללים החיים | `navHref(label)`, `visible(label)`, `buildNav()` |
| משתמש/תפריט | `boot.employee` + `/api/me` (שם, מחלקה) | `user()` -> `{loggedIn,initial,name,role,dept,sub}`; `branchName()` (מ-`gmach_name`) |
| חיפוש עמודים | ניווט מסונן מקומית | `searchPages(q)` |
| חיפוש נתונים | `/api/global-search?q=` (כמו TopbarSearch: מינימום 2 תווים) | `await searchData(q)` -> `{orders:[{l,i,href}],customers:[{l,sub,i,href}],total}` |
| "נפתחו לאחרונה" | `localStorage['agy_history']` (אותו מפתח שהאתר כותב) | `recent()` -> `[{l,sub,i,href}]` |
| "הצג הכל" | `/?q=` | `viewAllHref(q)` |
| פעמון | `/api/notifications` (רשימה), `?light=1` (מונה) | `bellEnabled()`, `await notifications()`, `await unreadCount()` |
| סימון נקרא / הסרה | `POST /api/notifications/read`, `/archive` (**לא הורצו**) | `markRead(id)`, `markAllRead()`, `archive(id)`, `archiveAll()` |
| משמרת | `/api/me` -> `activeShift.entryTime` | `shift()` -> `{start}`\|null, `shiftText()` -> `'3:42'`\|null, `refreshShift()` |
| פס הודעות | `/api/orders/overdue` (חלונית "הזמנות שלא הוחזרו") + הודעות "בין משמרות" | `await notices()` -> מערך בפורמט DEMO של nbAdd |
| יציאה | `POST /api/logout` ואז `location='/'` (כולל אישור "משפחות באיחור" כמו UserMenu) | `logout(confirmFn?)` |
| תחתית | boot + הגדרות | `footer()` -> `{groups:[{h,links:[{label,key,href}]}],name,ver,date,privacy}` |

כללי הרשאה בניווט (זהים לאתר): קבוצת "ניהול", "מחירון"/"ניהול מחירון" -> רק `isHead`; "הודעות" -> מחובר ו-`hide_internal_messaging!=='true'`; "שעון נוכחות", "השעות שלי", "עיצוב ותצוגה" -> מחובר; "עובדים ונוכחות", "לוח חודשי", "קטלוג דגמים", "זיכויים...", "תיקונים", "משלוחים" וכו' -> לפי `navGroups`. כתובות: מחירון/ניהול מחירון `/dashboard/pricelist`, לוח ניהול `/admin`, הגדרות מערכת `/admin/settings`, ניהול אתר `/admin/site`, הרשאות `/admin/permissions`, הודעות `/messages`, שעון נוכחות `/punch-clock`, השעות שלי `/my-hours`, עיצוב ותצוגה `/display-settings`, פרופיל `/profile`.
בנווה יעקב כרגע: `hide_internal_messaging='true'` ולכן "הודעות" והפעמון מוסתרים (כמו באתר); `enable_alterations='false'` ולכן "תיקונים" מוסתר.

## (ב) פערים (GAPS)
1. **שעון משמרת**: באתר החי אין שעון "משך משמרת" (רק "בעבודה כעת / לא בעבודה"). המשך מחושב מ-`Shift.entryTime` של משמרת פתוחה היום. **אין משמרת פתוחה -> `shift()`=null -> להסתיר את `.sn-clock` ואת `.sn-dfoot small`** (לא להציג 3:42 מומצא).
2. **תחתית**: "מדריך למשתמש" אין עמוד באתר -> לא מוחזר. "דיווח על תקלה" באתר הוא חלון (ErrorReportButton) ללא כתובת: מוחזר `href:null` (מוצג רק כש-`hide_error_reporting!=='true'`); אין דרך לפתוח אותו מבחוץ. או להסתיר, או להשאיר כמצב "לא זמין". `ver`/`date` = null: `version.json` לא מוגש ב-HTTP ואין API לגרסה (אפשר route קטן אם רוצים).
3. **מדיניות פרטיות**: באתר חלון בעמוד הבית עם טקסט זמני; `footer().privacy` מחזיר אותו (כותרת + פסקאות) לשימוש `privacyDlg()`.
4. **פעמון**: "כניסה להזמנה" רק כשההודעה מזכירה `הזמנה #NNN` (אחרת `href:null`, להסתיר את `.nf-go`). "סמן הכל" = סימון אחד-אחד (אין נתיב מרוכז). "הסרה/ניקוי" = ארכוב (ניתן לשחזור ב-/messages). הרשימה עד 150 (האב-טיפוס חתך ל-20 רק ב-push).
5. **חיפוש**: בחלון רק הזמנות ולקוחות (האתר מציג גם שמלות בעמוד המלא, לא בחלון). האתר חותך רשימה מאוחדת ל-15 (לקוחות נעלמים כשיש 15+ הזמנות); כאן עד 8 הזמנות + שאר לקוחות.
6. **פס הודעות**: אין באתר מערכת הודעות כללית; מחוברים רק שני מקורות אמיתיים (איחורים, הודעות בין משמרות). `kind:'warning'|'info'`.
7. `/api/a5/boot` לא מחזיר `enable_unreturned_orders_popup`, `hide_error_reporting`, `shift_handover_notes`; האדפטר שולף אותם מ-`/api/settings`. (חלופי: להוסיף ל-`SETTING_KEYS` ב-boot ולחסוך קריאה.)

## (ג) הוראות שילוב ב-`index.html` (מספרי שורות נכון להיום)
0. להוסיף `<script src="adapters/shell.js">` אחרי core.js; להריץ `A5.shell.init().then(...)` לפני בניית הסרגל. הפיכת ה-IIFE של `[S9]` (שורה 3405) ל-`A5.shell.init().then(()=>{...})` או להשתמש ב-`await`.
1. **NAV (שורות 3406-3419)**: להחליף את המערך ב-`const NAV = A5.shell.buildNav();`. פריטי `x.l/x.i` זהים; נוסף `x.href` (ולקבוצה בלי items: `g.href`). שורה 3420 (`SK_NAV_CUR`) נשארת.
2. **קישורים (`linkH` שורה 3424, ו-`<a class="sn-tab">`/`sn-acc` בשורות 3426, 3431)**: `href="#"` -> `href="${it.href||'#'}"` (ל-`g.href` בקבוצות בלי items). ב-handler של הקליקים (שורות 3466-3474) **להוסיף בראש**: `if(a.getAttribute('href')&&a.getAttribute('href')!=='#'){ return; }` (לא לעשות `preventDefault`, ניווט רגיל). ל-`/rentals#rented` -> ניווט רגיל תקין.
3. **חיפוש (3476-3484)**: `pages` ו-`renderRes` -> `renderRes(q,box,menu)`: עמודים מ-`A5.shell.searchPages(q)` (כל פריט `{l,i,g,href}`); ריק -> `A5.shell.recent()` (כל פריט `{l,sub,i,href}`, אם ריק להסתיר את כותרת "נפתחו לאחרונה"). לכל `<a class="sn-link">` להוסיף `href="${p.href}"`. אחרי 2+ תווים: debounce 350ms, `A5.shell.searchData(q)` ולהוסיף את `orders`/`customers` בתוך `box` (אותו תבנית `<a class="sn-link">`, `sub` כ-`<small>`), וקישור "הצג את כל התוצאות (${total})" ל-`A5.shell.viewAllHref(q)`. להסיר את `recent` הקבוע (שורה 3477). להתעלם מתשובה מאוחרת (להשוות `q` הנוכחי).
4. **פעמון, סרגל (שורות 2664-2669 ו-`#snMark` שורה 3486)**: שורות ה-`sn-nt` הקבועות ב-HTML ו-`#snMark` הם ממילא מוחלפים ב-`panel.innerHTML=shell()` בשורה 3714; להסיר את שורה 3486 (מאזין `#snMark` על אלמנט שנמחק). התצוגה מנוהלת ב-`[S14]` (3702-3776):
   - שורות 3768-3771 (seed): להחליף ב-`A5.shell.notifications().then(l=>{ NF.list=l.map(e=>Object.assign({},e)); NF.seq=0; boxes().forEach(w=>{w.querySelector('.nf-list').innerHTML=NF.list.map(rowHTML).join('');}); sync(); })`. `id` הוא מחרוזת (uuid): לשנות `+row.dataset.nf` ל-`row.dataset.nf` (שורות 3753, 3757, 3761, 3762) ואת `e.id===id` נשאר תקין.
   - `rowHTML` (3712): הכפתור `nf-go` רק כש-`e.href`: `${e.href?'<button ... data-nf-go ...>':''}`.
   - `markRead(id)` (3732): אחרי עדכון המקומי, `A5.shell.markRead(id)` לכל מזהה שהיה `unread` (`id==null` -> `A5.shell.markAllRead()`); בלי `await`, עם `.catch(()=>{})`.
   - `remove(id)` (3742): הוסף `A5.shell.archive(id).catch(()=>{})`; בכפתור "ניקוי" (3755) `A5.shell.archiveAll(ids)`.
   - `go(id)` (3743-3750): במקום ה-`scrollTo`/`shine`/`toast`: `const e=NF.list.find(x=>x.id===id); markRead(id); if(e&&e.href) location.href=e.href;` (`ORDER_NO` שורה 3705 נמחק).
   - `WHO` בשורה 3734 (`push`) לא בשימוש בנתונים אמיתיים (`who` מגיע מהשרת). `nfPush` נשאר ל-toast מקומי.
   - **להסתיר את פריט הפעמון כולו** (`.sn-item[data-sn=bell]`, ה-`#ntAcc` במגירה, `#snBadgeM`) כש-`!A5.shell.bellEnabled()` (כלל האתר; בנווה יעקב הפעמון כבוי).
   - ריענון מונה: `setInterval(()=>A5.shell.unreadCount().then(n=>{...}),120000)` רק כשהלשונית גלויה (כמו NotificationBell). (אופציונלי.)
5. **משמרת (3488-3490 ושורות 2671, 3434)**: `const t0=...` -> `let sh=A5.shell.shift(); const tickShift=()=>{ const s=A5.shell.shiftText(); document.querySelectorAll('.sn-clock').forEach(c=>c.hidden=!s); ...textContent=s }` והסתרת `.sn-clock` ו-`.sn-dfoot small` כש-null. לרענן `A5.shell.refreshShift()` כל כמה דקות.
6. **משתמש**: ב-`syncTopBar` (שורות 3842-3850) להחליף את מקור `w` ב-`const u=A5.shell.user(); w=[u.initial,u.name,u.sub_role]`: `w[0]=u.initial, w[1]=u.name, w[2]=u.role`; שורת `.sn-uhead span` = `u.role + (u.dept&&u.dept!==u.role?' · '+u.dept:'')` (ה"נווה יעקב" של האב-טיפוס נגזר מ-`A5.shell.branchName()` במקום `PROFILES[S.profile].name`). מגירה (שורה 3434): `שרה כהן`/`ש` -> `u.name`/`u.initial` (או שה-`syncTopBar` כבר מעדכן `.snav .sn-av`; להוסיף `.sn-dfoot b`).
7. **תפריט משתמש (2676-2679)**: להוסיף `href` אמיתי ל-`הפרופיל שלי` (`/profile`) ול-`עיצוב ותצוגה` (`/display-settings`) (`A5.shell.navHref` לא מכסה; יש `A5.shell.profileHref/displayHref`). ה-handler `[data-sn-link]` (הסעיף 2) לא חוסם קישורים אמיתיים. **`התנתקות`**: להסיר `data-sn-link` ולהוסיף `data-sn-logout`; מאזין: `bar.addEventListener('click',e=>{ if(e.target.closest('[data-sn-logout]')){ e.preventDefault(); A5.shell.logout(t=>askConfirm(t)); } })` (`askConfirm` = דיאלוג האישור הקיים של הדף, או ברירת המחדל `confirm`). האתר גם מציג ב-UserMenu את "שעון נוכחות", "השעות שלי", "הודעות" - הם כבר ב-`עוד` בסרגל.
8. **פס הודעות (nbArea, שורות 3623-3698)**: אחרי `init`: `A5.shell.notices().then(l=>l.forEach(n=>{ window.nbAdd(n.kind,{title:n.title,detail:n.detail,rows:n.rows,go:n.go}); }))`. כפתור `.nb-go` (שורה 3687, מסומן "עבור להזמנה") -> `location.href=<href של אותה הודעה>` (לשמור `href` ב-`data-href` על ה-`.nb-w` או במפה לפי `id`). מקסימום 3 (כבר במימוש); `more` = מספר משפחות נוספות (אפשר לצרף שורה `['user','ועוד '+more]`).
9. **תחתית (`syncFooter` שורות 3854-3864)**: לבנות מ-`const f=A5.shell.footer(); mountSiteFooter($('#siteFoot'),{name:f.name, ver:f.ver, date:f.date, groups:f.groups.map(g=>({h:g.h,links:g.links.map(l=>[ic(FI[l.key],'sm')+l.label, l.href?`href-real="${l.href}"`:`data-link="${l.key}" data-label="${l.label}"`])}))})`. הבעיה: `siteFooterHTML` (שורה 3783) קבוע `<a href="#" ...>`; לשנות שם ל-`<a href="'+(l[2]||'#')+'" '+(l[1]||'')+'>'` ולהעביר `l.href` כפריט שלישי. ב-`document.addEventListener('click')` (שורה 4704) לפני ה-`toast`: `if(b.getAttribute('href')&&b.getAttribute('href')!=='#') return;`. "מדיניות פרטיות" (`data-act="privacy"`) נשאר; `privacyDlg` (שורה 4162) יכול להשתמש ב-`f.privacy.paragraphs`. לא להציג `ver`/`date` כש-null (`siteFooterHTML` כבר מדלג עליהם כשהם ריקים).
10. **פקדי דמה** (`#dRole`, `#dProfile`, `#dNotice`, `#nbDemoBtn`): להסיר/להשבית בגרסה האמיתית.
