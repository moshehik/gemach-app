# verify-kiosk — /customer-interface (app/customer-interface/page.js, kiosk.css)

ענף: `origin/redesign/site-v3-pages-kiosk` מול `origin/main`. ביקורת סטטית בלבד.

## פסק דין: ⚠️ תואם עם הערות (אין פערים חוסמים)

מנגנון הנעילה זהה בית-לבית. לא נמצאה דרך לשחרר נעילה בלי POST /api/login.

## ראיות (סקריפטים)
- `diff -w` על כל גוף הקומפוננטה (old 286-946 מול new 297-958: state, refs, effects, handlers, fetch, הדפסה, AI): **הבדלים רק ב-4 מקומות**: (1) הערות; (2) `alert` של חסימת popup: "נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס" ← "כדי להדפיס, צריך לאפשר חלונות קופצים בדפדפן" (מלל בלבד; החוזה §10 מציין את הנוסח הישן - להחליט אם חובה לשמר); (3-4) צ'יפ AI: className/מלל ("הצג מלאי לתאריך"→"הצגת שמלות לתאריך", "סנן והצג:"→"הצגת התוצאות:"), ה-onClick זהה (לא הופיע ב-diff). גוף `handleCatalogPrint` (HTML הפופאפ) זהה.
- `data-agy-id`: 48 מזהים ישן = 48 חדש, diff ריק.
- חילוץ babel של כל `on*/value/checked/disabled/href` ב-JSX: חסר/נוסף רק: עטיפות (`SizePill.onPick`, `clearFilters`, `Btn loading=` במקום `disabled=`), כפתור "נקה חיפוש" חדש (`setSearch('')`), `onKeyDown` נגישות על מתג "מידות שאזלו", `onClose` של 2 ה-Dialog. `disabled=aiLoading/regSubmitting/unlockLoading` הפכו ל-`loading=` (Btn: `disabled={disabled||loading}`) - שקול.
- parse של @babel/parser: old ו-new תקינים. imports: `getPaymentStatusColor` הוסר ולא בשימוש; `Dialog/Btn/IconBtn/Chip/Field/Tip/Icon/Card/V3Page/Empty/Badge` מיובאים מ-`@/app/v3/ui/components`.
- fetch: 6 קריאות (`/api/settings`, `/api/dresses?...&filterStatus=active`, `/api/employees`, `/api/pricelists/categories`, `/api/login`, `/api/orders?...`, `/api/customers`, `/api/ai`) - שורות זהות (סדר פרמטרים, bodies, headers) לפי ה-diff.
- localStorage: `ka_zoom_level` (קריאה+כתיבה), `ai_customer_chat` (כתיבה) - זהים. body classes `katelier-bg`, `hide-global-nav` - זהים (page.js:377-389).

## בדיקת מנגנון הנעילה (מיקוד)
| פריט | חדש (page.js) | זהה? |
|---|---|---|
| `requestFullscreen` בכפתור נעילה | 1167-1173 (סוגר גם מודל הזמנות, `setIsLocked(true)`) | ✅ |
| `fullscreenchange` שפותח מחדש מודל קוד | 393-404, תנאי `isLocked && !fullscreenElement && !showUnlockModal && !suppressRelockRef.current`, deps `[isLocked, showUnlockModal]` | ✅ |
| חסימת `contextmenu` כשנעול | 407-414 | ✅ |
| שחרור רק דרך `POST /api/login` (employeeId,password), `res.ok&&data.success` | 547-580, כולל `suppressRelockRef` 2.5 שנ' והדפסה עם `printModelRef` | ✅ (diff ריק) |
| ביטול לא משחרר | 1523-1524: רק `setShowUnlockModal(false)`, `setUnlockIntent('unlock')`, `setShowUnlockPassword(false)` | ✅ |
| כפתורי כותרת כשנעול פותחים מודל קוד | exit 1157, print 1145, unlock 1163, הדפסת דגם 1036, pills נעולים = `<span>` (אין פעולה) | ✅ |
| סדר `setUnlockIntent`→`setShowUnlockModal` | נשמר בכל המקומות | ✅ |

### Esc / לחיצה על הרקע בכל החלוניות בזמן נעילה
- קיימות שתי `Dialog` בלבד (page.js:1509, 1554). חלונית הקוד/שחרור: `onClose={() => {}}` + `closeOnScrim={false}` (Dialog.js: Esc קורא ל-`onCloseRef.current?.()` = no-op, לחיצת scrim דורשת `closeOnScrim`). כלומר Esc והרקע לא סוגרים ולא משחררים. לחיצת Esc ב-fullscreen מוציאה מ-fullscreen ברמת הדפדפן (בלתי ניתן לחסימה, כמו בישן) ואז `fullscreenchange` פותח את המודל (כבר פתוח → נשאר).
- חלונית הזמנות: Esc/scrim סוגרים אותה (חדש). **אין מעקף**: היא נפתחת רק מ-`handleModelDoubleClick` שמתחיל ב-`if (isLocked) return;`, ו-`setShowOrdersModal(true)` מתבצע סינכרונית לפני ה-await (אין race מול נעילה); כפתור הנעילה סוגר אותה. סגירתה אינה נוגעת ב-`isLocked`/fullscreen.
- לכידת Tab בתוך Dialog; אין מסלול נוסף שמשנה `isLocked` מלבד `handleUnlock` (חיפוש `setIsLocked(false)` - מופיע רק שם).

## טבלת חוזה (תמצית)
| פריט | קיים | זהה |
|---|---|---|
| stepper/שלבים, לוח עברי (3 selects+ניקוי `kiosk_cal_clear_btn`) | KioskCalendar (הוחלף שם מ-AtelierCalendar; לוגיקה ללא הבדל ב-diff של הקומפוננטה הראשית; הקלנדר עצמו שונה JSX - לא נבדקה בעין) | ⚠️ |
| רישום עצמי, ולידציה `getMissingRegFields`, POST /api/customers, stub disabled `self_order_stub_btn` | 1227-1290 | ✅ לוגיקה; מלל הצלחה שונה |
| סינון/חיפוש/קטגוריות/מידות/מתג אפסים/3 תצוגות/ניקוי | 1330-1400 | ✅ |
| AI (hero, צ'אט, `[FILTER:]`/`[DATE:]`, prompt, POST /api/ai) | 959-1000, 1197 | ✅ (prompt ללא diff) |
| זום + `zoom_range_input` | 1131 | ✅ |
| הדפסת קטלוג | 495-620 | ✅ (למעט מלל alert) |
| מודל הזמנות: כותרת, טווח, ריק, טעינה, קישור /orders/ID `target=_blank` | 1554-1592 | ✅ מלל שונה |

## סטטוסי תשלום (lib/orderStatus)
`calculatePaymentStatus` נשמר ומשמש את אותו חישוב; תווית הצ'יפ = הערך המוחזר, אז אף סטטוס לא נעלם ולא מתויג לא נכון. מיפוי צבע: `שולם`→done, `ממתין לזיכוי`→info, כל השאר (`שולם חלקי`, `לא שולם`)→attn. **הערה:** בישן חלקי=warning ולא שולם=danger (שני צבעים), בחדש שניהם באותו attn - הבחנה חזותית נעלמה (התווית עדיין נכונה). הצעה: `gold` ל"שולם חלקי".

## הערות לא חוסמות
1. מלל `alert` פופאפ ומלל הצלחת רישום/כפתור איפוס ("הרשמה נוספת" במקום "רישום לקוח נוסף"; "מספר הלקוחה שלכם" במקום "מספר לקוח") - החוזה §13 מסמן כמלל לכתיבה מחדש, אך §10 מציין את ה-alert. 
2. z-index: חלונית נעילה היא `--v3-z-scrim: 100` (ישן 99999). כשנעול, ה-shell מוסתר (`hide-global-nav`), ו-z-index של תוכן העמוד נמוך; לא נמצא אלמנט מעליה, אך ראוי לאימות בדפדפן (בעיקר toasts/V3 notify: `body:has(.v3-scrim.is-on) .v3-toast{z-index:90}` מכסה זאת).
3. חלונית הקוד עברה מ"סיסמה בשדה ישיר" ל-Dialog variant=form (בהירה, R19), שדה select מקושר `value/onChange` ל-`unlockEmployee` (Field מעביר `...rest`), password input ל-`unlockPassword` - זהים.
4. `Dialog` נועל גלילת body ומחזיר פוקוס - לא משפיע על הנעילה.
5. `.v3k-form` אינו תחת `.v3k` (הדיאלוג ב-portal) - קיים כסלקטור עצמאי, תקין. אין `left/right` קשיחים או צבעי hex ב-kiosk.css החדש.
6. `zoom` CSS על אזור התוצאות (סיכון §14.3) - לא נבדק ב-CSS לעומק.

## לא נבדק סטטית (דורש דפדפן)
- התנהגות fullscreen/Esc בפועל, מיקום מודל מעל הכל כשנעול, גלריית `.v3k-*` RTL, מובייל (Dialog form כגיליון תחתון), `zoom` ו-getBoundingClientRect, תצוגת KioskCalendar, כפתור הדפסה בפופאפ.
