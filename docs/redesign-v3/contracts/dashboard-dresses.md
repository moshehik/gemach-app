# חוזה עמוד: `/dashboard/dresses` (מאגר שמלות - קטלוג ראשי)

מקור: `app/dashboard/dresses/page.js` ('use client'), `app/dashboard/dresses/layout.js` (PageGate). עוזרים: `lib/apiCache.js` (`fetchSharedJson`, `readCache`, `TTL`), `app/lib/prefetchRoutes.js` (`buildDressesListParams`), `app/lib/dressImageUrl.js` (`getDressThumbUrl`), `app/components/LabelsContext` (`useLabels().getLabel`), `lib/hebrewDate.js` (`getHebrewDateString`), `next/link`, `useRouter`.
שורות מצוינות = `page.js` אלא אם צוין אחרת.

## (א) מטרה + גישה
- מטרה: קטלוג דגמי שמלות - רשימה מעומדת (שרת), חיפוש, סינון סטטוס/מתקדם, מיון, ופעולות דגם (כניסה לכרטיס, מחיקה, שחזור, החזרה לפעילות).
- גישה: `layout.js:5-6` -> `<PageGate pageKey="page:dresses_catalog">` (`canOpenPage` מ-`lib/permissions.js`); כשל -> `NoAccessMessage`. ברירת מחדל: הנהלה ראשית/מתכנת בלבד (roleId 0/2), אחרים לפי שורות הרשאה ב-`/admin/permissions`. אותו layout חל גם על `/dashboard/dresses/[id]`, `/new`, `/[id]/print`.
- הגבלות פנימיות ב-UI (state `isHeadManagement`, שורות 28,104-110): נגזר מ-`GET /api/me` -> `data.employee.roleId === 0 || === 2`. מסתיר: כפתור "דגם חדש", כפתור "שחזר", כפתור "מחק". (השרת אוכף: `POST /api/dresses`, `DELETE /api/dresses/[id]`, ו-`PUT` שאינו activity-toggle - `checkAuth('הנהלה ראשית')`.)
- הגדרת `restrict_dress_catalog_to_head_management` = לא בשימוש (הוחלפה במסך הרשאות).

## (ב) מבנה לפי סדר
1. `.page-head`: h1 "מאגר שמלות - קטלוג ראשי" + `.page-desc` "סה"כ רשומות: {totalDresses}"; `.page-actions`: כפתור אייקון סינון מתקדם + (head-mgmt) כפתור "דגם חדש".
2. `.toolbar` > `.search-toolbar`: חיפוש חופשי + כפתור ניקוי.
3. `.pill-tabs` סטטוס: פעילים / לא פעילים / מחוקים / הכל.
4. (מותנה `showAdvancedFilters`) `.card.card-pad` "סינון מתקדם:".
5. טעינה: `.loading-inline` "טוען נתונים..." או `.table-wrap` > טבלה `data` + `.table-foot` (ספירה + עימוד).

## (ג) שדות / קלט
| label | state | סוג | ברירת מחדל | הערות |
|---|---|---|---|---|
| placeholder "חיפוש טקסט חופשי (שם, מקט, מידה)..." | `catalogSearch` | text | '' | -> query `search`; כפתור `x` "נקה חיפוש" מופיע רק כשיש טקסט |
| שם דגם / קידומת (`#dresses-filter-name`) | `advancedFilters.name` | text | '' | -> `advName` |
| מידה (`#dresses-filter-size`) | `.size` | text | '' | -> `advSize` |
| מס' סידורי (`#dresses-filter-serial`) | `.serialNumber` | number | '' | -> `advSerial` |
| השכרות מינימום (`#dresses-filter-rentals-min`) | `.rentalsCountMin` | number | '' | -> `advRentalsCountMin` |
| לא בשימוש (פריט) (`#dresses-filter-not-in-use`) | `.notInUse` | checkbox | false | -> `advNotInUse` |
| בתיקון (`#dresses-filter-in-repair`) | `.inRepair` | checkbox | false | -> `advInRepair` |
| פריט מחוק (`#dresses-filter-item-deleted`) | `.itemDeleted` | checkbox | false | -> `advItemDeleted` |
| עמוד (`#dresses-page-num`) | `page` | number min 1 max `totalPages` | 1 | `onChange`: `parseInt`; מתעדכן רק אם `1<=v<=totalPages` |
| (לא מוצג ב-UI) | `limit` | - | 50 | קבוע, אין בורר |
| (מיון) | `catalogSort` `{key,direction}` | - | `{name,'asc'}` | מפתחות: `barcodePrefix`,`name`,`entryDateToRepo`,`itemsCount` |
| סטטוס | `filterStatus` | 'active'\|'inactive'\|'deleted'\|'all' | 'active' | -> `filterStatus` |
אין ולידציה בצד לקוח (חוץ מטווח העמוד). אין שדות חובה.

## (ד) כפתורים / פעולות
| תווית / title | handler | פעולה / קריאה |
|---|---|---|
| (אייקון #i-list) title "סינון מתקדם" | `setShowAdvancedFilters(!…)` | פותח/סוגר פאנל; מודגש בצבע `--primary-solid` כשפתוח |
| "דגם חדש" (head-mgmt בלבד) | `router.push('/dashboard/dresses/new')` | ניווט לאשף (ר' חוזה `[id]`) |
| x "נקה חיפוש" | `setCatalogSearch('')` | |
| פעילים / לא פעילים / מחוקים / הכל (titles: "דגמים פעילים","לא פעילים","מחוקים","הצג הכל"; אייקונים `#i-check-circle`,`#i-x-circle`,`#i-trash`,`#i-list`) | `setFilterStatus(...)` | class `pill-tab active` לפעיל |
| "נקה סינונים" | `setAdvancedFilters({name:'',size:'',serialNumber:'',rentalsCountMin:'',notInUse:false,inRepair:false,itemDeleted:false})` | |
| כותרות עמודה sortable | `handleCatalogSort(key)` | אם אותו key ב-asc -> desc, אחרת asc. אייקון `#i-sort` (לא פעיל) או `#i-chevron-down` מסובב 180° ב-desc |
| Link "כרטיס שמלה" | `<Link href=/dashboard/dresses/${id}>` | `btn btn-primary btn-sm` |
| "שחזר" (אייקון #i-refresh, title "שחזר"; head-mgmt; רק כש-`dress.isDeleted`) | `handleRestoreModel(dress)` | `customConfirm("האם אתה בטוח שברצונך לשחזר את הדגם {barcodePrefix\|\|name}?")` -> `PUT /api/dresses/${id}` body `{isDeleted:false}` -> ok: `alert('הדגם שוחזר בהצלחה')` + `fetchDresses()`; שגיאה: `alert(err.error \|\| 'שגיאה בשחזור הדגם')`; catch `alert('שגיאה בתקשורת')` |
| "החזר לפעילות" (title זהה; לא-מחוק ו-`isInactive`; **ללא הגבלת head-mgmt**) | `handleReturnToActivity(dress)` | `customConfirm("האם אתה בטוח שברצונך להחזיר לפעילות את הדגם …?")`; אם אין `items` פעילים (`!notInUse && !isDeleted`) -> `alert('שימו לב: לדגם זה אין פריטים פעילים במלאי. כדי שהדגם יהיה פעיל לחלוטין, יש להיכנס לכרטיס השמלה ולהוסיף פריטים או להחזירם לשימוש.')` (לפני הקריאה); `PUT /api/dresses/${id}` body `{exitDateFromRepo:null}` -> ok `alert('הדגם חזר לפעילות בהצלחה')` + `fetchDresses()`; שגיאה `alert(err.error \|\| 'שגיאה בהחזרת הדגם לפעילות')` |
| "מחק" (אייקון #i-trash, title "מחק"; head-mgmt; לא-מחוק ולא-`isInactive`) | `handleDeleteModel(id)` | `customConfirm('האם אתה בטוח שברצונך למחוק דגם זה? לא ניתן למחוק אם יש פריטים מקושרים.')` -> `DELETE /api/dresses/${id}` -> `data.success`: `fetchDresses()`; אחרת `alert(data.error \|\| 'שגיאה במחיקת הדגם')`; catch `alert('שגיאה בתקשורת')` |
| "הקודם" / "הבא" (titles "עמוד קודם"/"עמוד הבא"; מופיעים כש-`totalPages>1`) | `setPage(p=>max(1,p-1))` / `min(totalPages,p+1)` | disabled בקצוות |

לוגיקת תצוגה לכל שורה (387): `isInactive = (!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo`. מחוק -> `row-flag` + תאים `cell-muted`; לא-מחוק+לא-פעיל -> רקע `--warning-tint`. בורר הפעולה: מחוק => שחזר; לא-פעיל => "החזר לפעילות"; אחרת => מחק.

## (ה) קריאות רשת
| # | method + URL | מתי | גוף/query | שימוש בתשובה | מטמון |
|---|---|---|---|---|---|
| 1 | `GET /api/dresses?{qs}` | mount + בכל שינוי ב-`[page,limit,filterStatus,catalogSearch,catalogSort,advancedFilters,totalPages]` (debounce 400ms); prefetch של `page+1` אחרי 1500ms כש-`page<totalPages` | `qs = buildDressesListParams(...)` = `URLSearchParams{page,limit,filterStatus,search,sortKey,sortDir,advName,advSize,advSerial,advRentalsCountMin,advNotInUse,advInRepair,advItemDeleted}` **בסדר הזה בדיוק** (הסדר = מפתח מטמון; חייב להיות זהה ל-`routePrefetchers['/dashboard/dresses']`) | תשובה `{data:[],totalPages,total}` או מערך גולמי; לא-מערך -> `console.error`. `setDresses/setTotalPages/setTotalDresses` (רק אם לא prefetch ו-`targetPage===page`) | `readCache(url)` -> הצגה מיידית אם `cached.data` מערך (`setLoading(false)`); ואז `fetchSharedJson(url,{ttl:TTL.LIST /*15s*/})` SWR. מוטציות מבטלות אוטומטית דרך interceptor של apiCache |
| 2 | `GET /api/settings` | mount (`fetchSettings`) | - | ממיר מערך `[{key,value}]` (או אובייקט) ל-`settings`, ברירות `{useModelNames:'true',useFileNamesForImages:'true',hide_dress_images:'false'}` | `fetchSharedJson('/api/settings',{ttl:TTL.STATIC /*5min*/})`; אין try/catch (דחייה = unhandled) |
| 3 | `GET /api/me` (fetch גולמי, ללא מטמון) | mount | - | `roleId 0/2` -> `isHeadManagement`; catch שקט | - |
| 4 | `PUT /api/dresses/${id}` | שחזור / החזרה לפעילות (ר' ד) | JSON | ר' ד | - |
| 5 | `DELETE /api/dresses/${id}` | מחיקה | - | ר' ד | - |
בעת כשל בשליפה: `setDresses([])` (רק אם לא prefetch). `useEffect` נפרד מאפס `setPage(1)` כשמשתנים `filterStatus,catalogSearch,catalogSort,advancedFilters`.
נטענות תמונות: `<img src={thumbSrc||imgSrc}>` ישירות (ר' ז).

## (ו) מודלים / פופאפים / טוסטים
- `window.customConfirm(text)` (גלובלי מ-`PopupProvider`) x3: מחיקה, שחזור, החזרה לפעילות (טקסטים ב-ד).
- `window.alert(...)` נייטיב (לא טוסט) - כל הודעות ההצלחה/שגיאה (ר' ד). **אין שימוש ב-toast**.
- אין מודלים משלו.

## (ז) מצבים מיוחדים
- `loading` -> `.loading-inline` "טוען נתונים..." (מוחלף על כל הטבלה, כולל בעת סינון; לא ב-prefetch; לא כשיש cache).
- ריק: שורה `colSpan = emptyStateColSpan = 4 + (showImageColumn?1:0) + (useModelNames?1:0)`, "לא נמצאו דגמים. נסה לשנות את הסינון או הוסף דגם חדש." (גם למשתמש בלי כפתור הוספה).
- עימוד רק כש-`totalPages>1`; שורת `.table-foot` תמיד: "סה"כ שורות מוצגות: {loading?'...':filteredDresses.length}"; ובעימוד: "עמוד [input] מתוך {totalPages} (סה"כ {totalDresses} תוצאות)".
- **SystemSetting-driven** (מ-`/api/settings`):
  - `useModelNames` (`!== 'false'`, ברירת true): מציג/מסתיר עמודת "שם דגם".
  - `hide_dress_images` (`=== 'true'` מסתיר): עמודת "תמונה" (`showImageColumn = !== 'true'`).
  - `useFileNamesForImages` (`=== 'true'`): מקור תמונה גיבוי `/images/dresses/${barcodePrefix}.jpg` כשאין `imageUrl`.
  - כותרות עמודות דרך `getLabel('item_barcode','קוד')`, `getLabel('item_modelName','שם דגם')` (תוויות ניתנות להתאמה לפי ארגון ב-LabelsContext).
- תמונה: `getImageSource` = `dress.imageUrl` || (הגדרה+prefix) || null. `thumbSrc = getDressThumbUrl(dress)` = `dress.thumbnailUrl||null`. `<img width=height=44 loading=lazy decoding=async>` src `thumbSrc||imgSrc`; `onError`: אם היה thumb ועוד לא נפל -> `dataset.fellBack='1'`, `src=imgSrc`; אחרת `display:none` ומציג את ה-`div.file-icon` שאחריו (`nextSibling`, "אין"). ה-div "אין" מוצג `display:none` כשיש `imgSrc`, אחרת `flex`. **הסדר DOM (img ואחריו div) חובה** - ה-onError תלוי ב-`nextSibling`.
- תאריך: `formatHebrewDate` = `getHebrewDateString(iso)` (fallback `toLocaleDateString('he-IL')`), '-' אם ריק.
- כמות פריטים: `dress.items?.filter(i=>!i.isDeleted).length || 0`.
- קוד: `dress.barcodePrefix || '-'`.
- offline/שגיאה: אין UI ייעודי (רשימה ריקה + console.error).

## (ח) URL params / storage
אין קריאה/כתיבה של query params, localStorage, sessionStorage. כל הסינון הוא state בזיכרון (אובד ברענון/ניווט). המטמון בזיכרון בלבד (`apiCache` Map).

## (ט) הדפסה / ייצוא / AI
אין. (הערה בקוד: תחליף ל-AISearchBar הישן - חיפוש טקסט חופשי בלבד, ללא AI.)

## (י) מלל (עברית)
מאגר שמלות - קטלוג ראשי · סה"כ רשומות: · סינון מתקדם · דגם חדש · חיפוש טקסט חופשי (שם, מקט, מידה)... · נקה חיפוש · פעילים · לא פעילים · מחוקים · הכל · דגמים פעילים · הצג הכל · סינון מתקדם: · שם דגם / קידומת · מידה · מס' סידורי · השכרות מינימום · לא בשימוש (פריט) · בתיקון · פריט מחוק · נקה סינונים · טוען נתונים... · תמונה · קוד · שם דגם · תאריך כניסה · כמות פריטים · פעולות · אין · כרטיס שמלה · שחזר · החזר לפעילות · מחק · לא נמצאו דגמים. נסה לשנות את הסינון או הוסף דגם חדש. · סה"כ שורות מוצגות · הקודם · הבא · עמוד קודם · עמוד הבא · עמוד · מתוך · (סה"כ … תוצאות) + הודעות ה-confirm/alert ב-(ד).

## (יא) Risk notes
1. **סדר פרמטרי ה-query = מפתח מטמון**: חובה להמשיך לבנות דרך `buildDressesListParams`; אחרת prefetch מ-`prefetchRoutes.js` (`/dashboard/dresses`) לא יפגע במטמון.
2. ברירת המחדל של מיון בעמוד `name asc` שונה מברירת ה-API (`entryDateToRepo desc`) - הפרמטרים תמיד נשלחים, אז לא משפיע; לא להסיר.
3. ה-effect של הטעינה תלוי גם ב-`totalPages` ו-`prefetchTimer` לא מנוקה - יצירת קריאות כפולות/prefetch קיימת בכוונה (או בטעות); שינוי מבנה state ישנה את תזמון הקריאות. לשמר.
4. כפתור "החזר לפעילות" **פתוח לכל מי שנכנס לעמוד** (לא head-mgmt) - כי השרת מתיר activity-toggle לכולם. אל תסתיר. כפתורי מחיקה/שחזור/דגם חדש - head-mgmt בלבד. שלושה מצבים בעמודת הפעולות מוציאים זה את זה (שחזר | החזר | מחק) - לשמר את ההיררכיה.
5. `alert()` נייטיב + `customConfirm` גלובלי: R19 קורא להחליף חלוניות, אך ההתנהגות (חוסם/אסינכרוני, תוצאה boolean) חייבת להישמר. הודעות ה-`alert` הן "הפידבק" היחיד - אם מוחלפות בטוסט, לשמר טקסט + תזמון (אחרי תגובה, לפני/במקביל ל-`fetchDresses()`).
6. `fetchSettings` ללא catch - כשל = `settings` נשארים על ברירות המחדל (עמודות מוצגות).
7. `img.onError` תלוי ב-`nextSibling` וב-`dataset.fellBack`; שינוי מבנה תא התמונה שובר את ה-fallback.
8. `isInactive` נגזר משדה `items` שמגיע ב-list API (חייב להישאר בתשובה) + `exitDateFromRepo`.
9. טבלה מותרת (R16: minimal) - כל 5-6 העמודות הן מידע הכרחי; הסינון המתקדם הוא לא-נשמר.
10. הניווט אל `/dashboard/dresses/new` נופל על `[id]='new'` (אשף) - הקשר בין העמודים; לא לשנות URL.
11. RTL: אייקוני chevron של עימוד משתמשים ב-`#i-chevron-end` ל"הקודם" ו-`#i-chevron-start` ל"הבא" (מכוון RTL).
