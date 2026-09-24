# אימות משפחת ordercard — `/orders/[id]`

ענף: `origin/redesign/site-v3-pages-ordercard` מול `origin/main` (da56c88 = merge-base, main לא זז). בדיקה סטטית בלבד (קריאה), ללא שרת.
קבצי המשפחה ששונו: `app/orders/[id]/page.js`, `ModernOrderCard.js`, `ModernGeneralDetails.js`, `ModernInfoTab.js`, `ActiveEmployeesModal.js`, `OrderPrintMenu.js`; חדשים: `orderCardDialogs.js`, `orderCardV3.css` (+ ספריית `app/v3/*` משותפת).
**לא שונו (cmp זהה בייט-לבייט):** `ModernItemsManager.js`, `ModernPaymentsManager.js`, `app/lib/orderDrafts.js`, `mocAuth.js`, `lib/*`.

## פסק דין: ⚠️ תואם עם הערות
אין פער חוסם מול `main`: כל ה-state, ה-effects, ה-handlers, קריאות הרשת, גוף ה-PUT, מפתחות ה-localStorage וה-props ל-Items/Payments זהים. השינוי הוא שכבת תצוגה + החלפת `alert/confirm/prompt` ב-`useV3Dialogs` (אותה זרימת await). יש סיכון תיאום משמעותי (סעיף "פערי תיאום") שדורש החלטה לפני מיזוג, ומספר הערות לא חוסמות.

## שני הנושאים המיוחדים
1. **טאב משלוח נפרד (`delivery_separate_tab`) — לא קיים ב-`origin/main` כלל** (`git grep` על main: 0 תוצאות). כרטיס המשלוח על main הוא כרטיס בתוך "פרטים" (מותנה `enable_deliveries`) ואותו מבנה נשמר בענף (`ModernGeneralDetails.js` שורות ~450-526: מתג `Switch`, כיוון, עיר `#delivery-city-edit` עם `deliveryCityRequired`, כתובת עם `deliveryAddressRequired`, מתג `deliveryOneDayBefore` מותנה `oneDayBeforeOption`, מצב תצוגה/עריכה). לכן זה לא איבוד פיצ'ר מול main. **אבל:** הפיצ'ר קיים בענף מקומי לא ממוזג `feature/order-card-redesign-neve-2026-09-24` (commit 6a05d92: `ModernDeliveryCard.js` חדש, MOC/MGD/page/PaymentsManager) — ראו "פערי תיאום".
2. **ת"ז הלקוח לא מוצגת:** ב-main `ModernGeneralDetails.js` לא הציג `customer.zeout`/`idNumber` בשום מקום (grep על הישן: 0 התאמות). `zeout` משמש רק בזרימת האימות (`requestZeout`, header `x-zeout`, body) — ואלה זהים. **אין שדה שאבד.** (B18 בחוזה-הסקיצה נשאר "לא להציג".)

## טבלת חוזה (מקוצרת; הפניות לקובץ החדש בענף)
| פריט | קיים? | זהה? |
|---|---|---|
| ארבעת הפאנלים תמיד mounted | MOC:290-301 `TABS.map` → `<div hidden={activeTab!==tab.id} style={display:none}>{tabContents[tab.id]}</div>`, בלי רינדור מותנה | כן (הוסתר ב-`hidden`+display, לא unmount) |
| ממשק props ל-ModernItemsManager / ModernPaymentsManager (כולל ref / `itemsManagerRef.scan`) | page:~1796-1900 | זהה: diff של בלוקי ה-JSX מחולצים = רק הערות (— → -). קבצי המנהלים עצמם זהים בייט-לבייט |
| prop חדש `getChangeRows={buildChangeRows}` ל-MOC (רייל "שינויים") | page:1783 | חדש, קריאה טהורה בלבד (`buildDraftRows` על snapshot) |
| PUT `/api/orders/[id]` גוף 30 המפתחות, `zeout` body+header `x-zeout`, 401/403/400/409 | page:`putOrder` | זהה (diff: רק מלל alert/confirm) |
| 409: "שמור בכל זאת / טען מחדש" | page:591-595 `await v3Confirm(...,{locked:true, confirmLabel:'שמור ודרוס', cancelLabel:'טען מחדש מהשרת'})` | ערך מוחזר boolean כמו `confirm`; locked = רק כפתורים |
| `requestZeout` | page:316-319 `await window.customPrompt` → fallback `v3Prompt` (מחרוזת/null, כמו `window.prompt`) | זהה זרימה |
| בדיקת מלאי `validate-inventory` + הודעת ציפוף + ולידציות תיקון/תאריכים | page:693-752 | זהה, מלל בלבד |
| חסימת חוב / אישור מנהל / `debtApprovedBy`, ביטול פריט → מנהל | page:785,825,1133 `window.customAuthPrompt` | זהה (הרכיב הגלובלי לא נגע; z-index 10000 > v3 100/140) |
| טיוטה מקומית (localStorage), באנר שחזר/מחק, "עודכן בשרת מאז" | page:~1740-1770 (`oc-pending-panel`), handleRestoreDraft/handleDiscardDraft | זהה; `orderDrafts.js` לא שונה |
| `hasUnsavedChanges` → `beforeunload`, `handleExit`, `customThreeWayConfirm`, יירוט קישורים | page:474,1103 | זהה |
| ביטול שינויים עם רשימת צ'יפים + `POST cancel-changes` | page:1347-1387 `v3Confirm({content:<Chip…/>})` | `customConfirm(<JSX>)` הוחלף ב-`v3Confirm`; אותו ענף אישור/ביטול, אותה קריאת cancel-changes |
| מחיקת הזמנה (חסימות, ת"ז, `DELETE`, `customConfirm`) | page:1395-1430 | זהה |
| חתימת תקנון = PUT מיידי + confirm | page:1461 (`customConfirm` נשאר, fallback v3Confirm) | זהה |
| חלון סיכום לפני שמירה (`enable_order_edit_summary_confirm`, נווה יעקב) | page:1610-1682 `Dialog` | אותו תוכן: חיובים, "חדש בשמירה הזו" (`savedObligationKeys`), סה"כ/שולם/יתרה, הערת מעבר לתשלומים; `closeOnScrim=false`, Esc → `handleSummaryConfirmDecision(false)` (ה-promise לא נתקע) |
| חלונית השלמת תשלום (`paymentContinueAmount`; אשראי / תשלום נוסף / אטפל בטאב) | page:1685-1735 | זהה, 3 הכפתורים עם onClick המקורי; Esc/רקע אינם סוגרים (כמו קודם) |
| שאלת הדפסה אחרי שמירה + `window.open /print/order` | page:982-986 | זהה |
| overlay "נשמרה" 5 שניות + `saveMessage` | page:1600-1604, MOC:225 | זהה (`Banner`; שגיאה לפי `includes('שגיאה'/'בוטלה')`) |
| מצבי loading / "הזמנה לא נמצאה" | page:1048,1059 | קיימים |
| נעילת אירוע שעבר (`isPastEvent`/`isLocked`), שחרור באישור מנהל, נעילה מחדש | MOC:198-210, 410-440, `handleLockClick` | זהה (`onUnlock` בתוך try/finally כמו קודם) |
| כפתור ארנק/חוב → `onWalletClick` / טאב תשלומים | MOC:186-196 | זהה |
| שמור / בטל שינויים / חזור = שמירה+יציאה / מחיקה / חתימה | MOC:386-403,219,176 | זהה handlers; `saving` ← `loading` (= disabled) כמו `disabled={saving}`. הכפתורים עברו מהכותרת לרייל |
| תג "₪ חוב + מגן" על שמור (`saveNeedsApproval`, `openedDebt`) | MOC:388-395 | זהה לוגיקה |
| סריקה מהירה `onQuickScan` (איפוס שדה) | MOC:111-117,273-282 | זהה |
| תפריט הדפסה/מייל: order/rental, מייל הזמנה/השכרה, sendMode, קבצים base64, חלון תקנון, חלון מייל | OPM:230-320 | זהה handlers/state. תפריט = `v3-menu` תמיד mounted עם `is-open` |
| "מייל מהיר" + "כתובת מייל חסרה" + `PUT /api/customers` | MGD, page:1890-1908 | זהה |
| החלפת לקוח (קיים/חדש, `POST /api/customers`, "@gmail.com", 6 שדות) | MGD:561-627 | כל 6 השדות עם אותם `newCustomer` setters |
| אירוע: רגיל/חו"ל, `HebrewDatePicker`, `HebrewDateRangePicker`, extraDay (+50%, `enable_rental_extension`), notes + internalNotes | MGD:312-440 | קיים; תלוי-הגדרה נשמר |
| ציפוף ימים מיוחד (`hide_custom_spacing`, ברירת מחדל מערכת, "רגיל") | MGD:445-470 | קיים |
| תשלום/זיכוי ידני מאוחד (`consolidate_manual_payment_credit_ui`) + בורר | MGD:535-540, 629-660 | קיים |
| תאריך ביצוע + אישור מנהל (מופיע ב-MGD וב-MIT) | MGD:551-560, MIT:105-142 | קיים בשניהם |
| טאב היסטוריה: `GET /api/audit?...search=`, `ACTION_TRANSLATIONS`, `ChangesChips`, loading/error/empty | MIT:145-203 | זהה |
| עובדים פעילים (`GET /api/orders/[id]/employees`, נטען רק בפתיחה) | AEM, MIT:110 | זהה; hooks זהים |
| הגדרות: `enable_deliveries`, `delivery_*`, `require_id_for_edit_cancel`, `allow_edit_partially_rented`, `order_edit_redirect_screen` | grep `find('…')` ישן/חדש | זהה |

## ראיות (פלט סקריפטים, מקוצר)
- `cmp ModernItemsManager.js` / `ModernPaymentsManager.js` main vs branch: `ITEMS_SAME`, `PAY_SAME`.
- חילוץ שורות `use(State|Ref|Memo|Callback|Effect)|fetch\(|JSON.stringify|method:|headers|find\('|localStorage|handle*|save*` מכל 6 הקבצים, diff ישן/חדש: **הבדל יחיד בכל המשפחה** — MOC: `+ const [railOpen,setRailOpen]=useState(false)` (UI בלבד) ו-`+ handleWallet` (עוטף את אותה קריאת `onWalletClick||onTabChange('payments')`). page/MGD/MIT/AEM/OPM: אין הבדל (מלבד שורת עזר `savedKeys` → `sc?.savedObligationKeys`).
- diff של בלוקי JSX `<ModernItemsManager …>`, `<ModernPaymentsManager …>`, `<ModernGeneralDetails …>`, `<ModernInfoTab …>`, `<ActiveEmployeesModal …>` בעמוד: רק שינוי מקף בהערה + `getChangeRows` ל-MOC.
- `customConfirm/customPrompt/customAuthPrompt/customThreeWayConfirm/beforeunload/window.open/router.*/setActiveTab`: רשימה זהה, למעט `window.customConfirm(<JSX>)` בביטול-שינויים שהוחלף ב-`v3Confirm`.
- `@babel/parser` על כל 7 הקבצים: OK. סריקת scope (traverse): אין משתנה לא מוגדר (`URLSearchParams` = גלובלי דפדפן); `createPortal` הוסר יחד עם כל השימושים; `alert(` גולמי בעמוד = רק בהערה; `v3Alert` ללא await = רק ב-OPM (3 מקומות).
- כל מחלקות `oc-*`/`v3-*` בשימוש קיימות ב-`components.css`/`tokens.css`/`orderCardV3.css`.

## פערים חוסמים (מול main)
**אין.**

## פערי תיאום (לא באג בענף; דורש החלטה לפני מיזוג)
1. **`feature/order-card-redesign-neve-2026-09-24` (לא ממוזג ל-main, אין PR)** נוגע באותם קבצים: `page.js` (~338 שורות), `ModernGeneralDetails.js`, `ModernOrderCard.js`, `ModernPaymentsManager.js` + `ModernDeliveryCard.js` חדש (טאב משלוח נפרד `delivery_separate_tab`, רצף יציאה טורי, הודעת יתרה ממתינה, redirect אחרי שמירה, שמירה no-op, בדיקת מלאי ב-PUT). מיזוג ענף ה-v3 (שכתב את ה-JSX של MOC/MGD ואת קריאות ה-alert בעמוד) יתנגש קשות. **ממליץ:** למזג קודם את ענף נווה ל-main ואז לבנות מחדש את שכבת ה-v3 מעליו (כולל טאב משלוח נפרד ב-MOC כשההגדרה פעילה, והעברת כפתורי "הוסף חיוב משלוח" ב-PaymentsManager). אחרת טאב המשלוח הנפרד של נווה יעקב יאבד במיזוג.
2. שמות הטאבים שונו מ-"פרטים כלליים / פריטים והשכרות / מידע" ל-"פרטים / פריטים / היסטוריה". מלל עזרה בקוד עדיין מפנה לשמות הישנים: `lib/howToGuide.js:54`, `lib/permissionsMetadata.js:477`, `lib/settingsMetadata.js:280`, `ModernPaymentsManager.js:953`. לעדכן מלל (לא נתונים).

## הערות לא חוסמות
1. **`enqueueNotice`/`v3NoticeSaved` חדשים** (page:970-972,1282,1290,1420) עם `persistToBell:true`. כרגע `V3NotifyProvider` **לא מחובר** לעץ (README של notify) — הקריאות רק כותבות ל-`sessionStorage['v3.notice.queue']` ואינן מציגות/שולחות דבר. ברגע שה-Provider יחובר יישלח `POST /api/notifications {category:'activity_note'}` — **קריאת רשת חדשה שאינה ב-main**, ולפי ה-README חייבים קודם את `reports/notify-api-patch.md`. הקריאות עטופות try/catch ואינן משנות זרימה. התור בסשן גדל בלי צרכן (מוגבל ב-dedupe).
2. **`v3Alert` ללא `await`** ב-OPM (שורות ~171,177,181): השליחה ממשיכה ברקע (`finally`/`setSending(false)` לא נעכבים כמו ב-alert החוסם). לא משנה נתונים.
3. **אלרטים שהיו סינכרוניים (חוסמים) הם כעת async**: בזרימות `handleSave/handleExit/putOrder` הקוד שאחרי alert (למשל `setSaving(false)` ב-finally) רץ רק אחרי סגירת החלונית; ספינר `saving` יישאר בזמן שהחלונית פתוחה. לוודא בדפדפן.
4. **Esc בחלון legacy מעל v3**: `customAuthPrompt` (z-index 10000) מוצג מעל חלוניות v3 (z 100/140), אבל ל-`Dialog` יש מאזין `keydown` בשלב capture שיגיב גם ל-Esc שנלחץ בתוך ה-prompt ה-legacy (עלול לסגור חלון "החלפת לקוח"/"כתובת מייל חסרה" שפתוח מאחור; חלון שחרור-נעילה מוגן ב-`!unlocking`). לוודא בדפדפן.
5. **Stepper — היגיון תצוגה נגזר** (MOC:131-150): `currentStep` = 1 (לקיחה) כשאין פריט שנלקח, 2 כשיש לפחות אחד שנלקח, 3 כשהכול הוחזר; ערכי הצמתים מ-`orderDate`, `fromDate/toDate`, ספירת `isTaken/isReturned`. נגזר מנתונים קיימים בלבד, ללא כתיבה/קריאה חדשה ובלי ערכים מומצאים (לא אירוע −2/+3, שליח, שעות — B11). "החזרה" מסומנת כשלב נוכחי (לא "בוצע") גם כשהכול הוחזר. תואם הצעת החוזה B11 — לאשר מוצרית.
6. **פיצ'רי סקיצה בלבד (28)**: לא נמצא היגיון מומצא — אין Math.random/דמו/mock בקבצי המשפחה (חוץ מ-id התראה ב-store.js); אין מייל חופשי (B1), צרופות מומצאות (B2), דף הכנה/משלוח (B9), ביטול פר-שינוי (B7), קוד 4 ספרות (B3), תמונת פריט (B13); חתימה נשארת PUT מיידי (B25). מוצג: טלפון נוסף (B20). הרייל "במבט אחד" מציג רק נתונים קיימים; רשימת שינויים = `buildChangeRows` הקיים (בלי סכומים).
7. `Tabs`: הכפתורים נושאים `id="tab-<id>"` והפאנלים `aria-labelledby` תואם. אין `id`/`data-*` ישן שנמחק ומשמש קוד אחר (`id="delivery-city-edit"` נשמר; אין querySelector בעמוד).
8. RTL/עיצוב: אין `left/right/margin-left`, hex או `<svg>` קשיחים בקבצי המשפחה; סכומים/ספרות ב-`<bdi>`; אייקונים דרך `<Icon>`. `ChangesChips` ו-Items/Payments עדיין בשפה הישנה (`card`,`btn`, sprite `#i-*`) בתוך `V3Page`.
9. `TipWrap` עוטף עוגן ב-`<span tabIndex=-1>` כדי לא לדרוס onClick — ה-onClick נשאר על הכפתור.

## מה לא ניתן לבדוק סטטית (דורש דפדפן)
- מראה הרייל (במובייל: גיליון תחתון מקופל; כפתורי שמור/בטל/חזרה נגישים כשהוא סגור), מראה מעורב v3 + legacy של Items/Payments בתוך `V3Page`, קיום ה-sprite הישן `#i-*` לצד `IconSpriteV3`.
- שמירה/יציאה עם חוב/409/מלאי בפועל; פוקוס ו-Esc בשרשרת חלוניות (`v3Alert` בתוך Dialog פתוח, תור `useV3Dialogs`); שמירת state פנימי של Items/Payments במעבר טאבים (המבנה אומת סטטית).
- נווה יעקב מול ראשי: הבדלים רק דרך הגדרות (אין `if(org)` בקוד — נבדק).
