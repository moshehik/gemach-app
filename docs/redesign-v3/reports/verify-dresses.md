# אימות התאמה — משפחת dresses

ענף: `origin/redesign/site-v3-pages-dresses` (590d77d) מול `origin/main` (da56c88 = merge-base; הענף מעודכן ל-main).
היקף: `app/dashboard/**`, `components/dresses/**` (16 קבצים ששונו + `useDressDialogs.js` ו-`dashboard-v3.css`/`dresses-v3.css` חדשים; ספריית `app/v3/**` נבדקה רק כתלות).
חוזים: `dashboard.md`, `dashboard-dresses.md`, `dashboard-dresses-id.md`, `dashboard-pricelist.md`.
שיטה: ייצוא שני העותקים ופרסור AST (`@babel/parser`/`traverse`): חילוץ קריאות רשת, hooks+deps, גופי handlers, דיאלוגים, storage, multiset של כל תכונות JSX מקושרות (`on*`, `value`, `checked`, `disabled`, `href`, `id`, `htmlFor`, `data-*`), בדיקת unresolved identifiers ופרסור על כל קובץ. קריאה מלאה של: items-tab, wizard, pricelist, dresses-list, [id]/page, Card, DetailsTab, RentalsTab, Modals, ItemModal, וכל רכיבי `app/v3/ui` הרלוונטיים (Btn, Field, Chip, Dialog, Stepper, Table, Tabs, Row, Feedback).

## פסק דין: ❌ פער חוסם אחד (תצוגה, לא נתונים) — כל השאר תואם

הלוגיקה, הרשת, ה-state וה-payloads זהים לישן. הפער החוסם היחיד הוא CSS: לוחות הלשוניות בכרטיס הדגם עלולים להיות גלויים כולם בו-זמנית (B1).

## פערים חוסמים

### B1. לוחות הלשוניות בכרטיס הדגם: `hidden` מנוצח ע"י `.v3-stack { display:flex }`
- חדש: `components/dresses/modern/ModernDressCard.js`, בלוק `TABS.map` בסוף הקובץ:
  `<div key={tab.id} role="tabpanel" aria-labelledby=... hidden={activeTab !== tab.id} className="v3-stack">`
- ישן: `<div className={'tab-panel' + (active ? ' active' : '')}>` (הסתרה ב-CSS של `.tab-panel`).
- מדוע חוסם: `.v3-stack { display:flex; ... }` ב-`app/v3/components.css:44` היא כלל author ולכן גוברת על כלל ה-UA `[hidden]{display:none}`. `git grep '\[hidden\]'` על הענף: אין כלל גלובלי `[hidden]{display:none !important}` (רק `.v3-combo__p[hidden]`, `.v3-combo__clear[hidden]`, `.v3-topbar__badge[hidden]`), ואין Tailwind/preflight בפרויקט. משמעות: ארבעת הטאבים (פרטים/מלאי/השכרות/יומן) יוצגו זה מתחת לזה והלשוניות לא יחליפו תוכן. (הטאבים נשארים mounted בכוונה, ולכן ההסתרה תלויה ב-CSS בלבד.)
- לא אומת בדפדפן, אבל הקסקדה חד-משמעית מהקוד.
- תיקון מוצע (אחד מהם): להוסיף ב-`components/dresses/dresses-v3.css` את `.v3-stack[hidden] { display: none; }` (או `[data-v3] [hidden] { display:none !important }` ב-`components.css`); או לעטוף `<div hidden=...><div className="v3-stack">...</div></div>`; או `style={activeTab !== tab.id ? { display: 'none' } : undefined}`.

## טבלת חוזה (תמצית)

| פריט בחוזה | קיים בחדש (קובץ) | זהה? |
|---|---|---|
| dashboard: 4 KPI (הכנסות, לקוחות פעילים, הזמנות, עובדים פעילים), שאילתות Prisma, `checkPageAccess(HEAD_MANAGEMENT_ROLES)` + `NoAccessMessage` | `app/dashboard/page.js` (Card x4; כל החישובים ללא שינוי) | כן, מעטפת בלבד |
| dashboard: 4 גרפים (עוגה לפי אמצעי, יומי, שבועי, חודשי), dataKey/nameKey/label/formatter ₪/Legend | `DashboardChartsImpl.js`, skeleton ב-`DashboardCharts.js` | כן (צבעים -> טוקני v3, שקיימים) |
| dresses: חיפוש חופשי + ניקוי, סינון סטטוס (active/inactive/deleted/all), סינון מתקדם (7 שדות, ids נשמרו), מיון 4 עמודות, עימוד, ריק/טעינה | `app/dashboard/dresses/page.js` (`Seg`, `Card` מתקדם, `Table columns`, footer) | כן: hooks זהים (diff ריק); Switch מעביר boolean (`Tabs.js`) ולכן `onChange={(v)=>...}` נכון |
| dresses: פעולות שורה (כרטיס/שחזור/החזרה לפעילות/מחיקה) + `isHeadManagement`, "דגם חדש" | `columns[actions]` | כן, תנאים זהים |
| dresses/[id]: 4 טאבים + count, קישור "דורשים טיפול" `onTabChange('items','attention')` | `ModernDressCard.js` (`Tabs`, `Chip onClick`) | קישורים כן; **B1 בפאנלים** |
| [id]: שמירה / ביטול שינויים (`disabled` כש-`!hasUnsavedChanges\|\|saving`) / יציאה / מחיקה / שחזור / הדפסה / ייצוא CSV | `ModernDressCard.js` Btn x6 | כן |
| [id]: שדות פרטים (קוד נעול בדגם קיים, שם, קטגוריה, isPremium, תאריך כניסה, פעיל/לא פעיל, בדיקה, הערות, imageUrl, העלאה/הסרה) | `ModernDressDetailsTab.js` | כן: מפתחות `onChange({...})` זהים; `id="dress-split-premium"` נשמר |
| [id]: מודל "לא פעיל" (סיבה + תאריך, ולידציית יציאה >= כניסה) | `ModernDressModals.js` (`Dialog variant=form`) | כן; `handleSave` זהה מלבד מלל השגיאה |
| [id]: מודל פרטי פריט + היסטוריה | `ModernDressItemModal.js` | כן: `fetch /api/dresses/items/${id}/history`, `useEffect [item?.id]` זהים |
| [id]: טאב השכרות (סטטיסטיקות, מסנן מידה, חיפוש, עימוד, קישור להזמנה בלשונית חדשה) | `ModernDressRentalsTab.js` | כן, 7 עמודות זהות |
| [id]: מחיקה רכה / שחזור (`PUT {isDeleted:false}`) / החזרה לפעילות (`saveDress({exitDateFromRepo:null, inactiveReason:null}, ACTIVITY_TOGGLE_FIELDS)`) | `[id]/page.js` | כן; רק `window.customConfirm` -> `confirm()` |
| [id]: אשף דגם חדש | `ModernNewDressWizard.js` | כן (ראו מיקוד 2) |
| [id]/print | `[id]/print/page.js` | כן, print-neutral |
| pricelist: טבלה לפי קטגוריה, עריכה בשורה, שורה/קטגוריה חדשה, נעילת מחיקה, callouts פערי מידות | `pricelist/page.js` | כן (ראו מיקוד 3) |

## מיקוד 1: לשונית מלאי (`ModernDressItemsTab.js`, 846 -> 910 שורות): זהה בלוגיקה
- רשת: אפס diff (כל הקריאות: PUT/DELETE/POST של items, location, box-number, restore).
- hooks: זהים, נוספו רק `dlg`/`dlgRef`. כל deps של `useMemo/useEffect` זהים.
- handlers: 8/11 גופים זהים בית-בבית; ה-3 ששונו הם רק החלפת דיאלוג/alert: `toggleNotInUse`, `deleteItem`, `restoreItem` (+ onClick עריכת סיבה). `askText` מחזיר מחרוזת/`null` כמו `customPrompt` (`if (reason === null) return;` נשמר); `askConfirm` מחזיר true/false; Esc/scrim -> false/null; `closeDlg` מנקה את ה-ref ופותר פעם אחת. הענף של fallback ל-`window.confirm` הוסר (לא נדרש).
- שדות: `#dress-items-search`, `#dress-items-newsize/newserial/newloc` נשמרו; `value/onChange/onKeyDown(Enter -> addItem)` זהים; `disabled={adding}`/`{rowSaving}` הוחלפו ב-`loading` של `Btn/IconBtn` (`Btn` מנטרל: `disabled || loading`).
- מסנני עמודות (`colFilters`), מיון (`handleSort` + `aria-sort`), עימוד, תצוגת קוביות (`serialRanges`, `addItemForSize`), עריכת שורה (Esc, שמירה/ביטול), ערכי `STATUS_FILTERS.id`: זהים. שינוי מלל בלבד: "דורש טיפול" -> "לטיפול", "מחוק" -> "נמחק" (רק label).

## מיקוד 2: אשף (`ModernNewDressWizard.js`)
- רשת: אפס diff. `handleCreate` (POST דגם + פריטים) זהה; 7/8 פונקציות זהות; hooks זהים.
- ולידציה: `step1Ok`/`canGoTo` ללא שינוי (`missingList` חדש רק להצגה). `Stepper.onStep` שומר `canGoTo(id) && !saving`; `StepNav`: `onNext` = `setStep(step+1)`, `nextDisabled = !canGoTo(step+1) || saving`; חזרה בצעד 1 = `onCancel`; כפתור יצירה `loading={saving}` + `handleCreate`.
- שדות: כל `id`/`value`/`onChange`/`onKeyDown(Enter -> addPendingItem)` נשמרו. `planned` ממופה 1:1 מ-`plannedItems` (`pendingItems[idx].key`), `removePendingItem(it.key)`. טבלת הסיכום: `key: idx`.
- מתג "בבדיקה": `Switch` (מקלדת מובנית); `onClick`+`onKeyDown` הישנים הוסרו כראוי.

## מיקוד 3: מחירון (`pricelist/page.js`)
- **`startDate`/`endDate` נשארים בגוף השמירה**: `handleEditClick` (חדש :100-101) `startDate: item.startDate ? item.startDate.split('T')[0] : ''`, `endDate` דומה; `handleAddNew` (:168-169) `startDate: '', endDate: ''`; `handleSave` שולח `body: JSON.stringify(editForm)` (אותו אובייקט; POST `/api/pricelists` / PUT `/api/pricelists/${id}`). ישן: :82-83, :148-149. אפס diff בקריאות רשת (GET pricelists, GET settings, POST/PUT/DELETE, `verify-pin` עם `requiredLevel:'הנהלה ראשית'`).
- `handleLockToggle`: `customAuthPrompt('...','הנהלה ראשית')` ללא שינוי. `handleDelete`: guard של `isLocked` נשמר; `askConfirm()` = Promise<boolean> (`settleConfirm`; Esc/scrim -> false).
- ids `pricelist-new*`, `value={x || ''}`, סדר קטגוריות (אין מיון בצד לקוח), callouts לפי `gapRule` (תנאים לא שונו), `disabled={isLocked}` בכפתור המחיקה: נשמרו. נוספה התראת `v3Toast` בהצלחה בתוך try/catch (לא משפיעה על השמירה).

## הדפסה: print-neutral
`[id]/print/page.js`: 9 שורות diff, כולן מלל בלבד (כותרות/תוויות). אין שינוי ב-`style`/`className`/`@media print`, ואין ייבוא של v3 (לא נטענים טוקנים/CSS). `window.print` והכפתור לא שונו.

## בדיקות חובה: סיכום
1. רשת: אפס הבדל בכל הקבצים (סדר query params וגופי JSON.stringify זהים, כולל `PUT /api/dresses/[id]`: `{isDeleted:false}`, `saveDress(patch, fields)`, `{exitDateFromRepo:null, inactiveReason:null}`).
2. State/effects: אפס הבדל מלבד תוספות: `dlg/dlgRef` (items tab), `confirmOpen/confirmResolve` (pricelist), `useDressDialogs` חדש (`state/resolver`).
3. Handlers: זהים אחרי נרמול, מלבד החלפות דיאלוג/alert בלבד, ו-`v3NoticeSaved` ב-`handleExit`/`onCreated` (try/catch; `saveDress` מחזיר `model` ולכן `saved.barcodePrefix` תקין).
4. שדות/כפתורים: אין `onClick`/`onChange` שנעלם ללא תחליף (פלט multiset בסוף).
5. דיאלוגים: `customConfirm` -> `confirm()`/`askConfirm()`/`settleConfirm()`, כולם await על Promise<boolean> עם ענף ביטול. `customPrompt` -> `askText` (string|null). `alert()` -> `notice()` (await, חוסם כמו alert: `handleReturnToActivity`, `onCreated`) או `v3Toast` (לא חוסם, במקומות שה-alert היה אחרון בזרימה). `customAuthPrompt` נשמר.
6. הרשאות: `checkPageAccess(HEAD_MANAGEMENT_ROLES)` + `NoAccessMessage` (dashboard), `isHeadManagement` (dresses); `pricelist/layout.js` לא שונה.
7. אחסון/ids: אין localStorage בקבצים אלה; ids של שדות נשמרו (`htmlFor` הוחלף ב-`Field id=`).
8. מלל-נתון: ערכי סטטוס (`active/inactive/deleted/all`, `attention`, `rows/cubes`), מפתחות מיון, `requiredLevel`: לא שונו.
9. RTL/עיצוב: ראו הערות.
10. קומפילציה סטטית: כל הקבצים מתפרסרים (JSX), אין unresolved identifiers, `'use client'` קיים, אייקונים תקינים (aliases `dress`->`shirt`, `back`->`chevron-start`).

## הערות לא חוסמות
1. `dresses/page.js`: רקע שורה לדגם מחוק (`row-flag`) ולדגם לא-פעיל (`--warning-tint`) הוסר; המידע נשמר כ-`Tag` ובצבע מעומעם. כנ"ל רקע `isNewRow` בשורת הוספה במחירון.
2. טקסטי ה-Tip בדשבורד ("כולל מבוטלות", "נטו") נבדקו מול השאילתות: `order.count()` ללא סינון, `payment.aggregate` כולל שליליים: מדויק.
3. שחזור/החזרה לפעילות ברשימה: `alert` חוסם -> `v3Toast` לא חוסם; `fetchDresses()` באותו סדר.
4. `openDlg`/`useDressDialogs`/`askConfirm` מחזיקים resolver יחיד: פתיחת דיאלוג שני לפני סגירת הראשון תשאיר את ההבטחה הראשונה תלויה. אין נתיב שפותח שניים במקביל, וזה זהה ל-`customConfirm` הגלובלי.
5. תאריך כניסה/יציאה (אשף, מודל לא-פעיל, DetailsTab): אין `label htmlFor` לקלט של `HebrewDatePicker` (קבוצת aria / span במקומו).
6. `Table` עם `rowKey` אינדקס (`_k`, `key`) כמו `key={idx}` הישן.
7. `width={44}` בתמונת הקטלוג נשאר לצד `var(--v3-tap)` ב-style (ערך HTML attr קשיח); `borderRadius:[4,4,0,0]` בגרפים.

## מה לא נבדק סטטית (דורש דפדפן)
- B1 בפועל (שני לוחות גלויים), וכן פופאובר `HebrewDatePicker` בתוך `Dialog variant=form` (z-index/focus-trap).
- ה-HTML `required` שנוסף ל-`Field required`: אין `<form>` עוטף בקבצים אלה, ולכן לא אמור להשפיע.
- מראה RTL של `Stepper`/`Table sticky`, אנימציית `key={step}` באשף, טעינת `dashboard-v3.css` מקומפוננטת שרת.

## ראיות (מקוצר)
```
=== app/dashboard/dresses/[id]/page.js
 [dialogs] - customConfirm x4, alert(failedItems)   + confirm({...}) x4, notice()
 [fn DIFF] handleCancelChanges/handleDelete/handleRestore/handleReturnToActivity -> confirm() only; handleExit + v3NoticeSaved
 fns identical: 9/15 ; network diff: none ; hooks diff: none
=== app/dashboard/dresses/page.js   network none ; hooks none ; customConfirm/alert -> confirm/notice/v3Toast
=== app/dashboard/pricelist/page.js
 [hooks] + confirmOpen/setConfirmOpen, + confirmResolve(useRef) ; network none
 startDate/endDate: old :82-83,:148-149  new :100-101,:168-169 ; body JSON.stringify(editForm) unchanged
=== components/dresses/modern/ModernDressItemsTab.js
 [hooks] + dlg/setDlg + dlgRef ; network none ; fns identical 8/11 (3 = dialog swap)
=== components/dresses/modern/ModernNewDressWizard.js   network none ; hooks none ; fns identical 7/8
=== ModernDressCard.js JSX multiset
 - onClick {() => onTabChange(tab.id)}   + onChange {(id) => onTabChange(id)} (Tabs)
 - className tab-panel(+active)          + hidden={activeTab !== tab.id} className="v3-stack"    <-- B1
=== [id]/print/page.js: 9 diff lines, text only
=== unresolved-identifier check: all files OK ; parse: all OK
```
סקריפטי ההשוואה (`ext.js`, `jsx.js`, `undef.js`) נמצאים ב-scratchpad של הסוכן.
