# אימות התאמה: משפחת customers

ענף: `origin/redesign/site-v3-pages-customers` מול `origin/main` (diff לפי `git diff -w origin/main...<branch>`).
היקף: `app/customers/page.js`, `app/customers/[id]/page.js`, `components/customers/modern/*` (7 קבצים) + קובץ חדש `customerDialogs.js`.
חוזים: `contracts/customers-list.md`, `contracts/customers-id.md`.
שיטה: `git show` על שני העותקים, סקריפט חילוץ (`cmp.js`) שסופר fetch/hooks/handlers/settings/dialogs/data-attrs, פרסור `@babel/parser` לכל הקבצים, וקריאת diff מלאה של כל קובץ.

## פסק דין: ⚠️ תואם עם הערות (תלות אחת שחוסמת מיזוג עד חיבור מנגנון ההתראות)

לוגיקה, נתונים ושדות תואמים. קריאות הרשת, ה-state, ה-effects והמטפלים לא שונו. הפער היחיד בעל השפעה הוא שאישורי השמירה/היצירה עברו מ-`alert()` ל-`enqueueNotice`, והמנגנון עדיין לא מחובר ל-`app/layout.js` (ראו פער 1).

## פערים חוסמים / תלויות

### 1. הודעת "הפרטים נשמרו" / "הלקוח נוצר" לא תוצג עד שמחברים את מנגנון ההתראות (תלות חוסמת-מיזוג)
- ישן: `alert('הפרטים נשמרו בהצלחה!')` ב-`app/customers/[id]/page.js` בענף main.
- חדש: `[id]/page.js:221-233` קורא ל-`enqueueNotice({... persistToBell:true ...})` בתוך try/catch.
- `app/v3/notify/README` (בענף) כותב במפורש: "עדיין לא מחובר ל-app/layout.js". חיפוש `V3NotifyProvider` / `V3MessagesToast` מחוץ לתיקיית `notify` בענף: 0 תוצאות.
- השפעה: לא נשבר שום נתון (`return true` נשמר, ה-PUT/POST זהים), אבל בלי Provider משתמש שלוחץ שמירה **לא מקבל שום משוב** על הצלחה (בישן קיבל alert). ביצירת לקוח יש ניווט מיידי לכרטיס, ובעדכון אין כלום.
- סיכון נוסף: README אומר שלפני `persistToBell` חובה ליישם את `notify-api-patch.md`, אחרת נוצר מייל/קטגוריה null. כרגע `persistToBell:true` קבוע בקוד הלקוחות.
- תיקון מוצע: לא למזג את הענף לפני חיבור `V3NotifyProvider` ב-AppShell ויישום `notify-api-patch.md`. אם המיזוג קודם, להחליף זמנית ל-`persistToBell:false` ולהשאיר גם `showAlert('הפרטים נשמרו בהצלחה!')` כגיבוי.

לא נמצאו פערים חוסמים אחרים.

## טבלת חוזה

### רשימה `/customers` (`app/customers/page.js`, שורות לפי הענף החדש)
| פריט בחוזה | קיים? | זהה? |
|---|---|---|
| `PageGate`/הרשאות (layout) | לא בטווח ה-diff, לא שונה | כן |
| fetch #1 `GET /api/customers` + סדר פרמטרים + `_t` + guard `isAiModeActive` (:123) | כן, לא שונה (0 שינויים בחילוץ) | כן |
| prefetch עמוד+1 (1500ms) | לא שונה | כן |
| `POST /api/ai/smart-search` + `handleAiSearch` | לא שונה, רק `alert`->`showAlert` (2 מקומות, אותן מחרוזות) | כן |
| `fetchCustomersForExport` | לא שונה | כן |
| ExportButtons: `columns` — `key:'id'` בעמודת 'קוד לקוח' (:269-270) | כן | כן, נשאר `id` ולא `legacyId` |
| `onFetchData`, `filename`, `iconOnly`, `data` | כן | כן |
| עמודות הטבלה: 6 עמודות, `legacyId/firstName/lastName/phone1/city/email` (:244-251) | כן, דרך מערך `columns` | כן. כולן דרך `getLabel` (מלבד 'קוד לקוח' שהוקשח גם בישן) |
| `handleSort(col)` על כותרת | כן, עבר מ-`th onClick` ל-`button` בתוך `th` (:349) | כן. `aria-sort` נוסף |
| `tr onClick` -> `/customers/${id}` (:357) | כן, + Enter במקלדת | כן |
| `legacyId` ריק -> "חדש"; email ריק -> `-` | כן (:360, :365) | כן |
| עימוד: הקודם/הבא, disabled ב-`page<=1`/`page>=totalPages`/`aiLoading`, AI -> `handleAiPageChange` | כן | כן |
| `#customers-page-num` (min/max/onChange/disabled) | כן, `className` -> `v3-input` | כן |
| חיפוש רגיל: `searchInput`, `handleSearch`, `handleClearSearch` (רק אם `searchInput`) | כן | כן |
| מצב AI: `aiInputText`, `disabled={aiLoading}`, X "נקה" (רק `aiInputText && !aiLoading`), `toggleAiInputMode`, "שאלות סטטיסטיקה" עם `e.clientX/Y` | כן | כן |
| `StatisticsModal` | כן, לא שונה | כן |
| חיפוש מתקדם: 5 שדות `#adv-search-*` + `getLabel` (city='עיר מגורים') | כן | כן, אותם `id` ואותם `advFilters.*` |
| לשוניות `basic`/`details` (`setAdvTab`) | כן, דרך `<Tabs>` | כן, אותם keys |
| `#customers-adv-ai-mode` -> `advAiMode` | כן: `<Switch id=... checked={advAiMode} onChange={setAdvAiMode}>` עטוף ב-`.ai-feature-element` | כן: `setAdvAiMode(v)` מקבל boolean, כמו `e.target.checked` |
| "נקה הכל" / "סגור והחל סינון" | כן: "ניקוי הכול" / "סיום", גופי ה-onClick זהים ל-diff | כן. שינוי מלל בלבד |
| `?search=` ב-mount | לא שונה | כן |
| מצב ריק | נוסף `<Empty>` כשאין שורות | תוספת בלבד |

### כרטיס `/customers/[id]`
| פריט בחוזה | קיים? | זהה? |
|---|---|---|
| `handleSave` מחזיר `true` בהצלחה / `undefined` בכשל | כן, `[id]/page.js` `return true` (אחרי `enqueueNotice`), כל ענפי `return;` ללא ערך, ה-catch ללא return | **כן**. הבלוק כולו אותו קוד; הוסיפו רק try/catch סביב ההתראה, כך שכשל בהתראה לא הופך הצלחה ל-throw. הלשונית "פרטים" עדיין תלויה ב-`attemptSave` (לא שונה) |
| כל 5 הלשוניות mounted | כן, `ModernCustomerCard.js`: `TABS.map` מרנדר תמיד כל 5 `tabpanel` עם `hidden` + `display:none` כשלא פעיל | כן. `tabContents` ב-page לא שונה, H מושך `/api/audit` ב-mount כמו קודם |
| `activeTab` ברירת מחדל `details`, `onTabChange` | כן | כן |
| ספירת הזמנות ב-badge | כן, `count: ordersCount` | כן |
| כפתורי כרטיס: שמירת שינויים / ביטול שינויים (`disabled=!hasUnsavedChanges\|\|saving`) / שליחת מייל / חזור (`onExit`) | כן | כן. `title` נשמרו |
| טופס חדש: 11 שדות `name` (`firstName..notes`) + `required` תמיד/לפי setting | כן, דרך `<Field required=...>` שמעבירה `required` לקלט | כן. `phone2`/`email` כוכבית דינמית נשמרה. `houseNum` נשאר `type=number` |
| `marketingConsent` (`#newMarketingConsent`) מחליף checkbox ל-`Switch` | כן | **שולח ערך זהה**: `handleChange({target:{name,type:'checkbox',checked:v}})` -> `customer.marketingConsent = boolean`, כמו הישן |
| `#marketingConsent` בעריכה | כן | זהה: `onChange({target:{name:'marketingConsent', value:v}})` עם `v` בוליאני, זהה לישן `value: e.target.checked` |
| `hide_marketing_consent_field !== 'true'` בשני הטפסים | כן | כן |
| `mandatory_field_groups` / `require_*` ב-`handleSave` ולידציה | לא שונה | כן |
| `handleEmailBlur` / `onEmailBlur`, "השלם ל- @gmail.com", "העתק כתובת מייל", "שלח מייל" בלשונית | כן (`Details:143-158`) | כן, אותם `onClick`. שינוי מלל: "השלמה ל-@gmail.com" |
| כפתור כותרת edit/check (`handleToggleEdit`, סגירה רק אם `true`) | כן, `IconBtn` | כן, המטפל לא שונה |
| city/street `list=` datalist + `autoComplete="new-password"` | כן | כן |
| `renderCustomerNotes` regex + קישור `/orders/{id}` | כן, רק העיצוב | כן |
| callout חסימה + "ביטול חסימה" רק ל-`isHeadManagement` | כן: `Banner` עם `action` מותנה | כן |
| `handleUnblockCustomer`: `await` על אישור, ביטול -> `return`, אחרת PATCH | כן: `await askConfirm(...)` | כן. `useConfirmDialog` מחזיר `Promise<boolean>` (Esc/scrim/ביטול=false). זרם ההמתנה נשמר |
| `handleSendEmailClick`: בדיקת email, `verifyPin` (`customAuthPrompt`), פתיחת מודל | כן, לא שונה (למעט מחרוזת ה-alert) | כן |
| בנק: 4 שדות (`bankName/bankBranch/bankAccount/bankAccountName`) + `onSubmit` | כן, `Refunds:32-41` | כן |
| היסטוריה: `searchInput`/`filterSearch`, "נקה" רק אם `filterSearch`, `/api/audit` | כן | כן |
| מודל מייל: `subject`/`body`/`files`(multiple)/`sendMode`/`driveFolderId` | כן | כן |
| `sendMode` רדיו -> `Seg` | כן, `{email,drive,both}` | **ערכים זהים**. `setSendMode(v)` בלבד, חסום כש-`loading`. `name="modernSendMode"` נעלם, ואין שום שימוש חיצוני בו (`git grep` ריק מחוץ למשפחה) |
| `driveFolderId` רק ב-drive/both + hint הרשאת הורדה | כן | כן |
| POST `/api/send-email` גוף (`username/password` = employeeId/pin וכו') | לא שונה (בגוף `handleSubmit`) | כן |
| סגירת המודל: `!loading` ב-backdrop ובכפתור ביטול | כן (`onClose` עטוף ב-guard, `disabled={loading}` לביטול) | כן. Esc הוא תוספת עם אותו guard |
| כפתור X בכותרת המודל | לא קיים | ראו הערה 3 |
| טעינה / `!customer -> null` / הפניה ל-`/customers` בשגיאה | כן | כן |

### לשונית הזמנות: אימות שלא אבד שדה מהטבלה בת 6 העמודות
| עמודה ישנה | מיקום חדש (`OrdersTab`) | חישוב |
|---|---|---|
| קוד הזמנה | `Link` "הזמנה {orderId}" בשורה (:80) + `stopPropagation` | זהה |
| תאריך אירוע/השכרה (`isWeekdayEvent`: לקיחה/החזרה, אחרת `eventDateHebrew`/`eventDate`/`orderDate`/`-`) | `v3-item__meta` (:84-93) | זהה, כל הענפים |
| סטטוס פריטים (`calculateOrderStatus`) | `<Chip>` בשורה (:97) | זהה. מיפוי: הוחזר->done, הושכר->info, בקרוב->gold, שאר->ניטרלי |
| סכום לחיוב (obligations לא `isDeleted`, אחרת `totalAmount`) | `Row "סכום לחיוב"` בפירוט המורחב (:113) | זהה |
| שולם (payments לא `isDeleted`) | `Row "שולם"` בפירוט המורחב (:114-117) | זהה |
| סטטוס תשלום (`calculatePaymentStatus`) | `Row "סטטוס תשלום"` בפירוט המורחב (:119) | זהה. מיפוי: שולם->done, חלקי->gold, ממתין לזיכוי->info, אחרת attn |
| מיון `getEventSortDate` יורד | לא שונה | כן |
| ניווט `/orders/${orderId}` בלחיצה על שורה | `router.push` על `v3-item__top` (:73) + Enter | כן |
| ריק / סה"כ | `Empty` "אין הזמנות ללקוח הזה" / "סך {N} הזמנות" | כן |

לא אבד אף שדה. שלוש העמודות הכספיות עברו לפירוט שנפתח בחץ (סגור כברירת מחדל).

### לשוניות תשלומים / זיכויים
| פריט | מצב |
|---|---|
| KPI: חיובים / שולם / זיכויים (רק אם >0) / יתרה (`debt`, "חובה"/"זכות"/מאוזן) | כולם קיימים, החישוב לא שונה |
| טבלת תשלומים: תאריך, סוג, סכום (עם `-` בזיכוי) בטבלה. הזמנה מקושרת, אופן תשלום/סיבה, הערות/סטטוס בפירוט מורחב | כל ששת השדות נשמרו. `rowKey` = `entryType-id` כמו המפתח הישן |
| טבלת זיכויים: תאריך, הזמנה (`Link`), סכום בטבלה. סיבה + תאריך ביצוע בפירוט. סטטוס "בוצע/ממתין" בטבלה | נשמרו כל השדות. תאריך הביצוע עבר מתוך ה-badge לפירוט |

## ראיות: פלט סקריפט ההשוואה (`cmp.js`, שינויים בלבד, מקוצר)
```
## app_customers_page.js          [dialog] alert(: old=2 new=0   (-> showAlert)
## app_customers__id__page.js     [dialog] alert(: old=9 new=0 ; customConfirm(: old=1 new=0 (-> useAlertDialog/useConfirmDialog)
                                  [handler] const savedName =: old=0 new=1
                                  [setting] settings.require_*/mandatory_field_groups: old=3-7 new=2  (הועלו ל-consts groups/emailRequired/addressRequired/idRequired; אותם ארבעה מפתחות)
## ModernCustomerOrdersTab.js     [hook] useState(: old=0 new=1   (openId, מצב פתיחה של החץ; UI בלבד)
## ModernSendEmailModal.js        [dataattr] name="modernSendMode": old=1 new=0 ; id="customer-email-form": new=1
שאר הקבצים: 0 הבדלים ב-[fetch] [method] [body] [hook] [handler] [perm] [storage].
```
- קריאות רשת: אין הבדל בשום URL, method, גוף או סדר פרמטרים (fetch/fetchSharedJson/method/JSON.stringify).
- Effects ומערכי תלות: `useEffect` זהים (ספירה ותוכן).
- `@babel/parser` (jsx): OK על כל 10 הקבצים. כל האיקונים ב-`name=` קיימים בספרייט. `--v3-sp-9` מוגדר ב-`tokens.css`.

## הערות לא חוסמות
1. **חלוניות במקום `alert`**: `showAlert` לא חוסם, ב-`window.alert` הקוד עצר עד שסגרו. בכל ענפי `handleSave` ההודעה מופיעה ואז `return`/`finally`, אין קוד שתלוי בעצירה. `ask` (אישור חסימה) מחכה כמו קודם.
2. **מלל שהשתנה** (לא נתון ולא נשמר): כותרת האישור "לבטל את החסימה?" במקום "ביטול חסימה" + טקסט; "שמירת הלקוח" במקום "שמור פרטים"; "סיום"/"ניקוי הכול"; "חיפוש חכם"/"בונה שאילתה..." במקום "חפש בחכמה"/"מייצר שאילתה...". חוזה (י) מציג את המחרוזות הישנות; צריך לעדכן את המלאי אם המחרוזות ננעלות.
3. **כפתור X בכותרת מודל המייל נעלם** (Dialog לא מציג X). נשארו Esc, לחיצה על הרקע וכפתור "ביטול", כולם עם אותו guard `!loading`. הודעת "המייל נשלח" עדיין נסגרת אוטומטית אחרי 2400ms.
4. **הצבעים הסמנטיים של סכומים אבדו**: "שולם" ירוק/אדום בהזמנות (יש רק צ'יפ "שולם במלואו"), סכום זיכוי באדום. הנתון עצמו נשמר.
5. **hint "כל הזמנה מחייבת 2 אמצעי תקשורת"** ביצירת לקוח עבר מפסקה גלויה ל-`tip` (ⓘ). חוק עסקי שהמשתמש ראה תמיד, כעת מוסתר מאחורי אייקון. שווה לשקול להחזיר כ-`hint` גלוי.
6. **עמודות "סיבה" ו"ביצוע" (זיכויים) ו-3 עמודות ההזמנות/התשלומים** מוסתרות מאחורי חץ מורחב: כל המידע נגיש אך דורש קליק נוסף לסריקה.
7. **RTL/עיצוב**: `style={{ direction: 'ltr' }}` נשארו על קלטי טלפון/מייל/ת"ז (מכוון). ב-`ModernCustomerCard` וברשימה נוספו `<bdi>` לספרות. `marginInlineStart` בשימוש. לא נמצאו `left/right` קשיחים חדשים.
8. `alert()` נותרו: 0 בקבצי המשפחה. `customAuthPrompt` (PopupProvider) עדיין משמש ל-PIN של מייל (לא בטווח).

## מה לא נבדק סטטית (דורש דפדפן)
- שהודעת השמירה אכן מוצגת אחרי חיבור `V3NotifyProvider` (פער 1).
- מיקוד/`Tab` בתוך `Dialog` בשילוב עם `customAuthPrompt`, וש-Esc בחלונית המייל לא סוגר גם חלונית אחרת בערימה.
- ש-`hidden` + `display:none` בלשוניות לא מפריע לטעינת `/api/audit` ב-mount (לוגית לא אמור, ה-mount נשמר).
- מראה `v3-switch` ב-RTL, ותצוגת `.ai-feature-element` מוסתר תחת `body.hide-ai-features` עם `Switch`.
- ביצועים של מטמון `pageCache` (לא שונה בקוד, אך מפתח המטמון לא נבדק בפועל).
