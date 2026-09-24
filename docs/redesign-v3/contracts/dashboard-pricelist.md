# חוזה: ניהול מחירון — `/dashboard/pricelist`

קבצים: `app/dashboard/pricelist/page.js` (P), `app/dashboard/pricelist/layout.js` (L), `lib/priceRows.js` (`listGapRanges`, `normalizeGapRule`, `GAP_RULE_CHEAPER`), `app/api/pricelists/route.js` (GET/POST), `app/api/pricelists/[id]/route.js` (PUT/DELETE), `app/components/PopupProvider.js` (`window.customAuthPrompt`, `window.customConfirm`).

## (א) מטרה והרשאות
- ניהול טבלאות מחיר השכרה + פיקדון לפי קטגוריה וטווח מידות: עריכה בתוך שורה, הוספת שורה/קטגוריה, מחיקה (מוגנת בנעילה), הצגת אזהרה/מידע על מידות "שנופלות בין טווחים" (`gap_size_price_rule`).
- גישה (שרת, L:9-14): `checkPageAccess(HEAD_MANAGEMENT_ROLES)` = `roleId` 0 (הנהלה ראשית) או 2 (מתכנת); אחרת `NoAccessMessage`. מנהל סניף (1) חסום, גם בכתובת ישירה. (לא ב-`dashboard/layout.js` כי הוא חוסם גם `/dashboard/dresses`.)
- API: `GET /api/pricelists` — `checkAuth()`; `POST`/`PUT` — `checkAuth('הנהלה ראשית')` (401); `DELETE` — `checkAuth()` + בדיקת `roleId` 0/2 בשרת (403 `'אין הרשאה למחיקה (נדרש סיווג הנהלה ראשית/מתכנת)'`).

## (ב) אזורים לפי סדר
1. `.page-head` (P:255-276): `h1` "ניהול מחירון", `.page-desc` "מחירי השכרה ופיקדון לפי קטגוריה ומידה"; פעולות: כפתור נעילת מחיקה, "מחירון חדש".
2. `loading` -> `.table-wrap > .page-loading` (spinner lg + `h3` "טוען נתונים...").
3. אחרת:
   - callout מידע (`callout-info`) — רק כש-`gapRule === 'cheaper'`.
   - callout אזהרה (`callout-warning`) — רק כש-`gapRule !== null && !== 'cheaper' && gapsByCategory.length>0`.
   - כרטיס "הוספת קטגוריה / שורה חדשה" — רק כש-`isAddingNew && editingId==='new' && addingCategory==='NEW'`.
   - לכל קטגוריה (`Object.keys(categoriesMap)`, לפי סדר הופעה; השרת ממיין `category asc, fromSize asc`): כותרת `h2.section-title` + "הוסף שורה לקטגוריה"; `.table-wrap` עם טבלה; `.table-foot` `סה"כ שורות מוצגות: {N}`. שורה חדשה לקטגוריה מוצגת בסוף ה-tbody.
- קטגוריה ריקה בנתונים מוצגת כ-`ללא קטגוריה`. אין empty-state למחירון ריק (רק הכפתור "מחירון חדש").

## (ג) שדות / קלטים
### טבלה — עמודות (P:389-396)
תיאור · מידות · מחיר השכרה · החזר פיקדון · פעולות.
### שורת עריכה (`renderEditRow`, P:187-251) — משמשת לעריכת שורה קיימת ולשורה חדשה בקטגוריה
| שדה | state (`editForm.*`) | טיפוס | placeholder (רק בשורה חדשה) |
|---|---|---|---|
| תיאור | `description` | text (`autoFocus` בשורה חדשה) | `תיאור` |
| מידות מ- | `fromSize` | number (רוחב 64px) | `מ-` (תמיד) |
| מידות עד | `toSize` | number (64px) | `עד` (תמיד) |
| מחיר | `price` | number (90px) | `מחיר` |
| פיקדון | `deposit` | number (90px) | `פיקדון` |
- קלטים מוצגים כ-`value={x || ''}` (ערך 0 מוצג ריק).
- `startDate`/`endDate` ב-`editForm` נשמרים ונשלחים בגוף ה-PUT/POST (`item.startDate.split('T')[0]`), **אך אין להם קלט בממשק**. חייבים להישאר בגוף (אחרת השרת מאפס אותם ל-null).
### כרטיס קטגוריה חדשה (P:334-374): `#pricelist-newCategory` "קטגוריה" (placeholder "לדוגמה: נשים") · `#pricelist-newDescription` "תיאור" ("לדוגמה: תחרה") · `#pricelist-newFromSize` "ממידה" ("36") · `#pricelist-newToSize` "עד מידה" ("44") · `#pricelist-newPrice` "מחיר (₪)" ("350") · `#pricelist-newDeposit` "פיקדון (₪)" ("50"). `.form-grid.cols-3`.
- אין ולידציית צד לקוח (כל השדות אופציונליים). השרת: מספרים דרך `parseInt/parseFloat` (ערך ריק/0 -> `null`), `category||null`.
- הצעת ברירת מחדל: `handleAddNew(category)` -> `fromSize = max(toSize של הקטגוריה) + 1` אם >0; `toSize/price/deposit=''`.

## (ד) כפתורים / פעולות
| כפתור | handler | קורא |
|---|---|---|
| נעילת מחיקה (P:261): מצב נעול: `btn-danger-ghost`, איקון `#i-lock`, טקסט "מחיקה נעולה", title "נעול - לחץ כדי לפתוח"; פתוח: `btn-secondary` ירוק, `#i-check-circle`, "מחיקה פתוחה", title "פתוח - לחץ כדי לנעול" | `handleLockToggle` | `window.customAuthPrompt('נדרש אישור הנהלה ראשית/מתכנת כדי לשנות את נעילת המחיקה.','הנהלה ראשית')` ואז `POST /api/auth/verify-pin`; הצלחה -> `isLocked = !isLocked` |
| "מחירון חדש" (P:271) | `handleAddNew('', true)` | פותח כרטיס קטגוריה חדשה (`addingCategory='NEW'`) |
| "הוסף שורה לקטגוריה" (P:380) | `handleAddNew(categoryName!=='ללא קטגוריה' ? categoryName : '')` | שורת הוספה בסוף הקטגוריה |
| עריכה (איקון edit, title "ערוך") | `handleEditClick(item)`: `editingId=item.id`, `editForm={...item, startDate/endDate ללא שעה}`, `isAddingNew=false` | — |
| מחיקה (title "מחק"; `disabled={isLocked}`, opacity .45; איקון `#i-lock` נעול / `#i-trash` פתוח) | `handleDelete(id)` (אם נעול: alert 'המחיקה נעולה. אנא פתח את הנעילה תחילה ע"י קוד מנהל/מתכנת.'); `await window.customConfirm('האם אתה בטוח שברצונך למחוק שורה זו? הפעולה אינה ניתנת לביטול.')` | `DELETE /api/pricelists/${id}` |
| שמור (title "שמור", ירוק) בשורה | `handleSave(isNewRow ? null : editingId)` | POST / PUT |
| בטל (title "בטל", אדום) | `cancelEdit`: `editingId=null, isAddingNew=false` (לא מאפס `addingCategory`) | — |
| "שמור" / "בטל" בכרטיס הקטגוריה החדשה | `handleSave(null)` / `cancelEdit` | POST |
| קישור "הגדרות המערכת" באזהרה | `<a href="/admin/settings">` (ניווט מלא) | — |

## (ה) קריאות רשת
| שיטה + URL | מפתחות | מתי | שימוש |
|---|---|---|---|
| `GET /api/pricelists` | — | mount + אחרי כל שמירה/מחיקה מוצלחת (`fetchPricelists`, מציג `loading`) | `res.ok` -> `setPricelists(data)`; אחרת/חריגה: `console.error`, ללא הודעה |
| `GET /api/settings` (fetch רגיל, ללא מטמון) | — | mount | מערך `{key,value}`; `gap_size_price_rule` -> `setGapRule(normalizeGapRule(value))` (`'cheaper'` או `'none'`); כשל/לא מערך -> נשאר `null` (לא מוצג דבר) |
| `POST /api/pricelists` | גוף = `editForm` כולו: `category, description, fromSize, toSize, price, deposit, startDate:'', endDate:''` | `handleSave(null)` | `ok` -> `editingId=null, isAddingNew=false` + רענון; אחרת `alert('שגיאה בשמירת הנתונים')` |
| `PUT /api/pricelists/${id}` | `editForm` = כל שדות הפריט הקיים + `startDate`/`endDate` (`YYYY-MM-DD`) | `handleSave(editingId)` | כנ"ל |
| `DELETE /api/pricelists/${id}` | — | אחרי אישור | `ok` -> `fetchPricelists()`; אחרת `alert('שגיאה במחיקה')` |
| `POST /api/auth/verify-pin` | `{pin, employeeId, requiredLevel:'הנהלה ראשית'}` | פתיחה/נעילה | `!success` -> `alert(data.error\|\|'סיסמה שגויה או שאין הרשאות מתאימות (נדרש סיווג הנהלה ראשית/מתכנת).')`; חריגה -> `alert('שגיאה באימות קוד הנהלה ראשית/מנהל.')` |
- אין `pageCache`/`apiCache`. הרשימה אינה מפריעה למטמונים אחרים; קריאה זו נעשית ישירות (אחרים — kiosk ועמודי שמלות — קוראים GET ללא התחברות).

## (ו) חלוניות / הודעות
- `window.customAuthPrompt` (PopupProvider, כותרת "אימות הרשאה", רמה `'הנהלה ראשית'`), `window.customConfirm` (מחיקה). `alert` נטיבי: כל ההודעות בסעיפים לעיל. אין toast, אין מודל מקומי.

## (ז) מצבים מיוחדים
- `isLocked` מתחיל `true` בכל טעינה (מצב זיכרון בלבד; לא נשמר).
- `gap_size_price_rule` (SystemSetting) — שני callouts:
  - `'cheaper'`: כותרת "מידה שאין לה שורת מחיר - מחויבת לפי הטווח הזול" + הסבר + רשימה `{קטגוריה}: מידה N / מידות A–B - לפי הטווח הזול ({description}), ₪{price}` או "כרגע אין במחירון מידות שנופלות בין טווחים."
  - אחרת (וקיימים פערים): כותרת "יש מידות שאין להן שורת מחיר" + "המידות הבאות נמצאות בין שני טווחים ואין להן מחיר, ולכן כרגע הן מחויבות 0 ₪:" + רשימה + הסבר והפנייה להגדרות ("מידה שנמצאת בין שני טווחי מחיר" / "לפי הזול משני הטווחים", קבוצת תשלומים).
  - `gapRule===null` (לא נטען) -> שום callout.
- פערים מחושבים ב-`listGapRanges(pricelists, cat)` לכל קטגוריה, למעט `NON_DRESS_CATEGORIES = ['תיקונים','תיקון אורך','חול','חו"ל']` (P:21). שורות ללא `toSize` או ללא `price` נשלחות מהחישוב.
- תצוגת שורה: מידות: `fromSize && toSize` -> `A - B`; רק from -> `מ-A`; רק to -> `עד B`; ריק -> `-`, ב-badge `badge-neutral`; מחיר `badge-primary ₪{price}` או `-`; פיקדון `₪{deposit}` או `-`; תיאור `-` אם ריק.
- מצב ריק, רענון ורק אחד עריכה במקביל (`editingId` יחיד) — עריכת שורה חדשה סוגרת את הישנה? לא: `handleAddNew` לא מאפס `editingId` קודם אלא מחליף ל-`'new'`; `handleEditClick` מאפס `isAddingNew=false`.
- אין תלות בארגון (org) בקוד העמוד.

## (ח) URL / אחסון
- אין query params, אין localStorage/sessionStorage.

## (ט) הדפסה / ייצוא / AI
- אין.

## (י) מלל (מלאי)
ניהול מחירון · מחירי השכרה ופיקדון לפי קטגוריה ומידה · מחיקה נעולה / מחיקה פתוחה · מחירון חדש · טוען נתונים... · הוספת קטגוריה / שורה חדשה · קטגוריה · תיאור · ממידה · עד מידה · מחיר (₪) · פיקדון (₪) · שמור · בטל · הוסף שורה לקטגוריה · מידות · מחיר השכרה · החזר פיקדון · פעולות · ערוך · מחק · ללא קטגוריה · סה"כ שורות מוצגות · הגדרות המערכת · מידה שאין לה שורת מחיר - מחויבת לפי הטווח הזול · יש מידות שאין להן שורת מחיר.

## (יא) הערות סיכון
1. `startDate`/`endDate` בלי UI אך חובה בגוף השמירה — עיצוב מחדש שיבנה את הגוף רק מהשדות הגלויים ימחק תאריכי תוקף.
2. גוף ה-PUT הוא כל אובייקט הפריט (כולל `id`, `createdAt` וכו') — השרת בוחר רק שדות מוכרים; לא לשנות מבנה.
3. הנעילה: הרמה חייבת להיות `'הנהלה ראשית'` ולא `'מנהל'` (באג היסטורי, ראו הערה בקוד P:63-71); מחיקת שורה מתבצעת גם בדפדפן רק כשה-`isLocked=false` — אך אכיפה אמיתית בשרת.
4. סדר הקטגוריות = סדר ה-`reduce` על תוצאת ה-API (`category asc, fromSize asc`); לא למיין מחדש בצד לקוח.
5. `key` של פערים: `${category}-${gap.fromSize}`; `gapsByCategory` מחושב מ-`pricelists` הגולמי (לא מתעדכן בעריכה עד שמירה).
6. `handleSave` מצליח = סוגר עריכה וטוען מחדש (spinner מלא של הדף מחליף את כל הטבלה, כולל מיקום גלילה).
7. `isNewRow` ב-`renderEditRow` נקבע לפי `key`: עריכה של קיים משתמשת ב-`item.id` כמפתח — לשמר יציבות ה-key כדי שלא יאבד פוקוס בהקלדה.
8. הקישור ל-`/admin/settings` הוא `<a>` רגיל (טעינה מלאה) — שינוי ל-`Link` אפשרי אך לא חובה.
9. שגיאות שרת (401/403/500) מוצגות כהודעה גנרית אחת (`שגיאה בשמירת הנתונים` / `שגיאה במחיקה`) — לא לשנות ללא אישור (R8).
