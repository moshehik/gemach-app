# אימות התאמה — משפחת orderitems

ענף: `origin/redesign/site-v3-pages-orderitems` מול `origin/main` (merge-base `da56c88`, ל-main אין קומיטים חדשים על הקבצים האלה מאז).
חוזה: `contracts/orders-id-items-payments.md` חלק 0 + חלק א׳. שיטה: `VERIFY-METHOD.md` (קריאה בלבד, בלי הרצת שרת).
קבצים: `components/orders/modern/ModernItemsManager.js` (IM), `OrderModelSelector.js` (MS), `OrderSizeSelector.js` (SS), `ItemCapacityModal.js` (CAP), `orderItemsV3.css`.

## פסק דין: ⚠️ תואם עם הערות (אין פערים חוסמים)

הלוגיקה, הקריאות, ה-state וה-handlers זהים. ההבדלים הם JSX/מלל/עיצוב בלבד, ומעט הערות (בעיקר נגישות ו-UX).
הסיכון הבין-משפחתי (MS ו-CAP משותפים ל-`app/orders/new`, `app/orders`, `app/rentals`) נבדק ולא נמצא בו אי-תאימות.

## ראיות אוטומטיות

1. **חילוץ מבני עם `@babel/parser`** (כל פונקציית handler בכל 4 הקבצים, אחרי ניקוי מחרוזות עבריות ו-JSX):

```
ModernItemsManager.js DIFF renderSameBandSizeSelect      (select -> SizeChips; ר' נקודה 4)
ModernItemsManager.js DIFF renderRepairChips             (הפך ל-getRepairInfo + renderRepairChips תצוגתי)
ModernItemsManager.js ONLY OLD renderStatusBadge / ONLY NEW renderStatusTag, getRepairInfo,
                      closeConfirm, closeItemChoice, closeManualScan, renderItemCard, toggleOpen   (תצוגה בלבד)
OrderModelSelector.js / OrderSizeSelector.js / ItemCapacityModal.js: אין הבדל בפונקציות
```
כל שאר ה-handlers זהים מבנית (AST): `handleBarcodeScan, chooseItemForBarcode, handleItemChange, handleModelChange, handleConfirmItem, handleEditItem, cancelEditItem, cancelNewItem, toggleDeleted, handleAddItem, handleRent, handleReturn, handleCancelRent, handleCancelReturn, handleSetReturnCondition, showItemDetails, handleReopenFullEdit, evaluateSizeSwap, canFullyEditItem, itemName/itemCode/itemModelId, dedupeAuditLogs`.

2. **diff שורות fetch/hooks/window.custom*/alert/import** (IM, ישן מול חדש): ההבדל היחיד ב-state הוא `+ const [openItems, setOpenItems] = useState({})` (פתיחת כרטיס, תצוגה בלבד).
   כל קריאות הרשת (`/api/settings`, `/api/pricelists` (תלות `[sizeEditDays]`), `verify-pin`, `rentals/verify-item`, `PUT rentals/scan`, `rentals/toggle` (+`postRentalRent/Return`), `returns/report-issue`, `orders/{id}/items[/{id}]`, `audit/order-item/{id}`) — זהות בכתובת, method, מפתחות body, headers ותנאי הפעלה. מפתחות ההרשאה זהים (`feature:item_edit_reopen`, `unpaid_action_items_tab`, `item_change_approval`).
   ה-diff של מחרוזות `alert/customPrompt/customConfirm/customAuthPrompt` הראה שינוי טקסט בלבד. מחרוזות-נתון (סטטוסים, ערכי מידה, מפתחות `HIDDEN_HISTORY_FIELDS`, `ACTION/FIELD_TRANSLATIONS`) לא שונו.

3. **eslint (no-undef, jsx-no-undef, rules-of-hooks) על 4 הקבצים החדשים**: 0 שגיאות ב-IM, SS, CAP (8 אזהרות `no-unused-vars` על `catch (err)`, קיימות גם בישן). ב-MS: 3 שגיאות react-compiler (`refs during render` על `autofillGuardNameRef.current`) — **קיימות גם בישן**, לא חדשות. כל ה-imports מוגדרים; `createPortal` הוסר ואינו בשימוש.

4. **מלאי איקונים**: כל איקון ב-MS/CAP קיים בספרייט הבסיס `app/components/IconSprite.js` (tag, search, x, calendar, list, check, external-link, info, alert-circle). איקונים ששייכים רק ל-`IconSpriteV3` (`shirt/dress`, `ruler`, `unlock`, `loader`) בשימוש רק ב-IM/SS, ו-IM מרנדר את הספרייט בעצמו (`V3Page` עם `sprite` ברירת מחדל). כלומר המקומות ש-CAP/MS נטענים בלי IM (orders/new, orders, rentals) לא יציגו איקון חסר.

5. **CSS גלובלי**: `tokens.css`/`components.css`/`icons.css` נטענים דרך `import` מ-`V3Page`. כל הכללים בשם מרחב `.v3-*`/`[data-v3]`/`.oi-*`; הכללים הלא-ממורחבים (`button:active > .v3-ic`, `[dir="rtl"]{--v3-dir}`, `tr[aria-expanded] .v3-th-btn` וכו') נוגעים רק ב-`.v3-*` או במשתנה `--v3-dir`. לא נמצא דליפת סגנון לעמודים הישנים.

## טבלת חוזה

| פריט בחוזה | קיים? (קובץ:שורה בחדש) | זהה? |
|---|---|---|
| חתימת קומפוננטה + props (`orderId, order, items, onItemsChange, onOrderUpdated, inventoryCache, totalRequired, totalPaid, locked=false`), `forwardRef` | IM:58 | זהה (בייט-ל-בייט) |
| `useImperativeHandle` → `scan: (barcode) => handleBarcodeScan(barcode)` | IM:230-232 | זהה |
| `onItemsChange` תמיד פונקציונלי (`prev=>`) | IM:369-401, 479, 495, 504, 562, 590-711 | זהה |
| באנר נעילה | IM:1135 (`Banner`) | תואם |
| "הוסף פריט" (מוסתר כש-locked) + `max_items_per_order` + גלילה ל-`listEndRef` | IM:1146, 536-564 | זהה |
| pill תיקונים (רק `enableAlterations`) / מחוקים | IM:1147-1154 | תואם (מתג ה"מחוקים" מוצג תמיד כמו קודם) |
| סיכום "N פריטים פעילים · סה"כ ₪X" | IM:1156-1157 | תואם |
| מצב ריק + "הוסף פריט ראשון" (גם כש-locked, `handleAddItem` חוזר) | IM:1167-1171 | זהה |
| עריכה: דגם (`OrderModelSelector`) + מידה (`OrderSizeSelector`), `canEditModelSize`, `currentCartItems` ללא הפריט | IM:971-995 | זהה |
| `canEditSizeOnly` + `renderSameBandSizeSelect` + הודעת דחייה `sizeSwapNotice` | IM:996-1019, 166-207 | לוגיקה זהה; select → SizeChips (נקודה 4 בהערות) |
| צוואר/שרוול/אורך (disabled כש-`!fullyEditableNow`), פירוט תיקון זמין תמיד, ולידציית פירוט | IM:1044-1067, 413-417 | זהה |
| כפתור "פתיחת עריכה מלאה" (`handleReopenFullEdit`) | IM:1029-1042 | זהה בתנאי |
| אישור / ביטול שורה (+"שומר…", ביטול מנוטרל בשמירה) | IM:874-886 | זהה |
| עריכה (`!isTaken`), השכרה (`!isTaken && !isNew`), החזרה/ביטול השכרה (`isRented`, ביטול רק `!locked`), ביטול החזרה + מתג מצב (`isReturned`) | IM:852-934 | עץ התנאים זהה (locked / isEditingMode / isDeletedRow) |
| פרטים / תפוסה (`!isNew`), מחיקה/שחזור (`!locked && !isNew && (isDeleted \|\| !isTaken)`) | IM:937-957 | זהה |
| תג "תיקון בוצע" (`alterationDone`, לא מגיב ב-locked) | IM:959-964 | הפך לכפתור, אותו handler ואותו תנאי |
| מצב הפריט בהחזרה (תקין/בעיה) → `handleSetReturnCondition` (customPrompt→null ביטול, אופטימי, שחזור) | IM:779-795, 681-715 | זהה |
| קישור שם לכרטיס דגם (`_blank`, `noopener noreferrer`), בלי modelId → טקסט | IM:825-835 | זהה |
| מודל אישור (rent/return/cancelRent/cancelReturn), באנר "לא שולם", טיפ סריקה, אישור → מודל ברקוד ידני כש-`barcodePrefix` | IM:1175-1222, 1184-1201 | זהה |
| בחירת פריט לברקוד (`itemChoiceModal`) → `chooseItemForBarcode` | IM:1225-1251 | זהה |
| ברקוד ידני (`onSubmit`: סגירה, trim, `handleRent(item, barcode)` בלי skipAuth) | IM:1254-1279 | זהה |
| פרטי פריט: חיובים (סינון `(פריט #id)`, זיכוי<0, סכום), 3 תאריכים, היסטוריה מקופלת + `dedupeAuditLogs`/`HIDDEN_HISTORY_FIELDS` | IM:1282-1414 | לוגיקה זהה (הושווה שורה-שורה) |
| `ItemCapacityModal` (`item, order, isOpen, onClose`), fetch `/api/inventory/capacity`, טווח ±חודש, KPI, רשימה/לוח, שגיאות | CAP:9, 27-84, 88-205 | לוגיקה זהה; מלל שונה |
| מתג רשימה/לוח (`viewMode`), `CapacityCalendar` (props זהים) | CAP:~140-165 | זהה; `CapacityCalendar` לא שונה |
| `data-agy-id` (MS input/dropdown_item/clear, SS select/option, CAP button_1/view_list/view_calendar) | MS, SS, CAP | נשמרו (`itemcapacitymodal_button_1` עבר מכפתור ה-X לכפתור "סגירה") |
| MS: fetch `/api/inventory/models?q[&hasActiveItems]` + debounce, Enter→`resolveTypedValue`, clear, portal | MS (ללא שינוי לוגי) | זהה |
| הגדרות: `enable_alterations`, `size_edit_until_days_before_event`, `gap_size_price_rule`, `max_items_per_order`, `require_manager_code_for_item_changes` | IM:138-160, 427, 521, 538 | זהה |
| localStorage/sessionStorage | — | אין, כמו קודם |

## סיכון בין-משפחתי: OrderModelSelector / ItemCapacityModal (בדיקה מול `origin/main`)

צרכנים ב-main: `app/orders/new/page.js` (MS עם `inputId="item-model"` ו-`hasActiveItems`, ו-CAP עם `isOpen={true}` שמורכב רק כשקיים `capacityModalItem`), `app/orders/page.js` ו-`app/rentals/page.js` (MS, `value={{name}}`, `onChange(m)` → `m ? m.name : ''`, `placeholder="בחר דגם..."`). `OrderSizeSelector` בשימוש ב-IM בלבד.

- **חתימות/props**: MS `{value, onChange, placeholder, inputId, hasActiveItems}` ו-CAP `{item, order, isOpen, onClose}` זהות; הקריאות ל-`onChange(model|null)` זהות; התנהגות בחירה/ניקוי/Enter זהה. SS מייצא בנוסף `SizeChips`/`describeSizeRow` (הוספה בלבד).
- **`inputId`**: נשמר, כך ש-`<label htmlFor="item-model">` ב-orders/new עדיין מקושר (ר' הערה על `aria-label`).
- **תלות בספרייט/CSS**: ראיות 4 ו-5 למעלה. אין דליפה ואין איקון חסר בעמודים שבהם IM לא נטען.
- **מסקנה**: לא נמצאה אי-תאימות. אין חוסם.

## פערים חוסמים

אין.

## הערות לא חוסמות

1. **מלל בלבד השתנה** (הודעות `alert`, טקסטי `customAuthPrompt`/`customConfirm`/`customPrompt`, תוויות כפתורים כמו "אישור"→"שמירת הפריט", "עריכה"→"עריכת הפריט", "השכרה"→"סמן כמושכר"). מותר לפי R10, אך אם יש תיעוד/הדרכה שמצטט את הכפתורים הישנים — לעדכן. `alert()` נשארו native, כמו בחוזה.
2. **פעולות מאחורי פתיחת כרטיס.** בישן כל הפעולות (השכרה/החזרה/עריכה/מחיקה/פרטים/תפוסה) היו גלויות בשורה. עכשיו הן בתוך `.v3-item__det` שמוסתר (`visibility:hidden`) עד לחיצה על הכרטיס או על ה-chevron (`components.css:407`). הכול נגיש, אך עם לחיצה נוספת (גם ההחזרה בהזמנה נעולה). שורה בעריכה/פריט חדש נפתחים אוטומטית. מומלץ לוודא בדפדפן שזה מקובל בתפעול (סריקה מהסיידבר ממשיכה לעבוד בלי פתיחה).
3. **`aria-label={placeholder}` ב-MS** מחליף את השם הנגיש של השדה, כך ש-`<label htmlFor="item-model">דגם</label>` ב-orders/new כבר לא נותן לו שם. מומלץ להשמיט `aria-label` כשיש `inputId` עם label, או להשתמש ב-`aria-label` רק בלי label חיצוני.
4. **ברירת המחדל של `placeholder` ב-MS** השתנתה מ-"בחר דגם..." ל-"חיפוש דגם או קוד". משפיע רק על orders/new (שאינו מעביר placeholder); orders ו-rentals מעבירים ערך מפורש. גם הודעת ה-`alert` ב-Enter ללא התאמה שונתה (מלל).
5. **SizeChips**: לחיצה על המידה שנבחרה שולחת `onChange('')` (ביטול בחירה). בישן ה-select הרגיל אפשר היה לחזור ל-"-" גם כן; ב-`renderSameBandSizeSelect` הישן אי אפשר היה (`<option value="">` רק כש-`!value`). ההשפעה: אפשר לרוקן `sizeText` בהחלפת-מידה-בלבד, אבל `handleConfirmItem` חוסם שמירה בלי מידה (`!item.sizeText`), כך שאין סיכון נתונים. גם ההשוואה `sizeVal === value` מחמירה (ה-select השווה כמחרוזת); `sizeText` הוא string ב-DB ולכן אין שינוי בפועל.
   ערכי המידה הנשלחים זהים (`s.sizeText || s.size`, כולל חצאי מידות ו-'other'). כפתור מידה disabled לפי אותו תנאי (`selectedAvail <= 0`, עם `withCustomSpacing` כשמוגדר `order.customSpacing`).
6. **CAP והעקיפה של קריסת `Dialog`**: `Dialog` קורס אם הוא מורכב עם `open=true` (ה-effect ניגש ל-`ref.current` שעדיין `null`). ב-IM כל ה-Dialogs נטענים עם `open=false` ונפתחים רק בהמשך — תקין, ואין effect/fetch שרץ ב-mount של Dialog סגור (ה-effect שלו יוצא מיד כש-`!open`; הקריאות ב-IM ובתת-רכיבים נשארו כמו בישן). ב-CAP הפתרון `dialogReady` (מורכב סגור ואז נפתח) תקין לשני הצרכנים הנוכחיים, שמרכיבים את CAP רק כשהוא פתוח. **סיכון רדום**: CAP מחזיר `null` כש-`!isOpen` ולכן ה-Dialog מתפרק; אם צרכן עתידי יחזיק CAP מורכב וישנה `isOpen` false→true, `dialogReady` יישאר `true` וה-Dialog יורכב עם `open=true` → קריסה. מומלץ להחליף ל-`open={isOpen && dialogReady}` בלי `if (!isOpen ...) return null`, או לאפס `dialogReady` כש-`!isOpen`.
7. **`Tip` מרנדר portal לכל מופע** גם סגור (`mounted && createPortal(<div role=tooltip>)`); ב-IM יש מופעים רבים לכל כרטיס. אין fetch, רק DOM נוסף. `Tip` בתוך `<label>` (`Field tip`) יכול להפעיל פוקוס על השדה בלחיצה.
8. **RTL/עיצוב**: `.oi-drop` משתמש ב-`top/left` פיזיים בכוונה (מדידת `getBoundingClientRect`, מתועד בקוד). גדלים קשיחים ב-`orderItemsV3.css`: `max-height:280px`, `minmax(88px,1fr)`, `max-width:160px`, `16px`, `999999`, `letter-spacing:.5px`. תקינים אך לא דרך tokens. `<bdi>` בשימוש למספרים. `CapacityCalendar` לא עבר עיצוב מחדש ועדיין משתמש בסגנונות inline ובמשתני CSS ישנים (ממשיכים להיות מוגדרים גלובלית).
9. `app/version.json` שונה בענף (0.1.414→0.1.418) — צפוי להתנגש במיזוג; לפתור בזמן ה-merge.
10. מידע נוסף שנוסף (לא הוסר): שורת מחיר לפריט בכרטיס הפתוח (`finalPrice||price`) והעברת פירוט תיקון לשורה נפרדת.

## מה לא ניתן היה לבדוק סטטית (דורש דפדפן)

- מראה/גלישה של כרטיסי הפריט, ה-`SizeChips` (grid `auto-fill`) וה-dropdown של MS בתוך `orders/new` (עמוד לא-v3) ובתוך כרטיס ההזמנה; RTL אמיתי ו-`getBoundingClientRect` של ה-dropdown.
- ש-`Dialog` (focus-trap, נעילת גלילה, Esc) מתנהג נכון לצד `customAuthPrompt`/`customConfirm` של `PopupProvider` (z-index ופוקוס) במעבר confirm→ברקוד ידני→אימות מנהל.
- פתיחה/סגירה של כרטיסים לפי `openItems` עם סריקה מהסיידבר, ומעבר עריכה→שמירה (`savedLocalId`) בפועל מול השרת.
- הצגת `CapacityCalendar` בתוך `Dialog` (רוחב `sheet`), ומובייל (גיליון תחתון).
- טעינת ה-CSS (סדר ה-imports) ותצוגת האיקונים הכלליים בפועל.
