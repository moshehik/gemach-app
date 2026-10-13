# תכנון: ריבוי סניפים (2026-10-12)

ענף: `feature/branches-2026-10-12`. הבקשה של הבעלים ("נושא הסניפים", 7 סעיפים) מפורקת כאן לארבעה שלבים. כל מה שחדש פועל **רק כשההגדרה `multi_branch_enabled` דלוקה**; שורה חסרה / `false` = המערכת כמו היום, בלי שינוי בממשק או בלוגיקה (כלל "שורה חסרה = ההתנהגות הקיימת", CLAUDE.md).

## 1. מה כבר קיים (נבדק על `origin/main` 2519d009)

| נושא | מה קיים | איפה |
|---|---|---|
| סניף ביצוע / סניף איסוף בהזמנה | `Order.branch`, `Order.pickupBranch` (מחרוזות). נשמרים בהזמנה חדשה (אשף A5 + הטופס הישן) כשההגדרות `track_branch_on_order` / `branches_enabled` דלוקות | `prisma/schema.prisma`, `app/components/new-order/*`, `app/orders/new/LegacyNewOrderPage.js` |
| רשימת סניפים | `branch_list` (שמות מופרדים בפסיק), `branches_enabled`, `default_order_branch`, `track_branch_on_order` - קבוצת "סניפים" בהגדרות. נווה יעקב עובד איתם | `lib/settingsMetadata.js`, `lib/settingsSimLayout.js` (סעיף `branches`) |
| סינון הלו"ז לפי סניף | `?branch=` בלו"ז היומי, לפי `pickupBranch \|\| branch` | `lib/schedule/index.js`, `app/components/schedule/ScheduleDay.js` |
| מיקום פריט פיזי | `DressItem.location` (מחרוזת: `חנות` / `רזרבה` / `מחסן` / `מושכר`; ריק = בחנות), `DressItem.cartonNumber`, רשימת מיקומים בהגדרה `item_locations`. השכרה/החזרה כותבות `מושכר` / `חנות` | `app/api/rentals/*`, `app/api/returns/scan`, `lib/dressCardLogic.js` |
| חסימת רזרבה / מחסן להשכרה | `inventory_include_warehouse`, `allow_renting_reserve_items` (זיהוי לפי המילים "מחסן" / "רזרבה" בתוך `location`) | `lib/inventory.js`, `app/api/rentals/scan` |
| התראת "שמלה בסניף אחר" | `lib/dressLocationAlerts.js` (`enable_dress_location_alert`) - **רק בכרטיס ההזמנה**, וההשוואה היא "האם המילה של סניף מופיעה בתוך `location`". לא מחובר ללו"ז, ו-`location` נדרס ל"חנות" בכל החזרה, ולכן זה לא יכול להחזיק סניף | `app/api/orders/dress-location-alerts` |
| פעמון התראות | `Notification` (הודעות פנימיות) ← `/api/notifications` ← `NotificationBell` (מעטפת ישנה) ו-`MenuBell` (A5). `notifyManagers()` קיים | `app/components/NotificationBell.js`, `app/components/menu/MenuBell.js` |
| פס התראות מתחת לסרגל (A5) | `useNoticeBar().add({...})` (`menu/NoticeBar.js`); במעטפת הישנה אין פס, יש חלון (`OverdueRemindersWatcher`) | `app/components/menu/*` |
| שורות לו"ז עם התראה | `row.alerts` (`lib/schedule/alerts.js`), נבנות ב-`getScheduleDay` | `lib/schedule/index.js`, `StageRow.js` |

**מה לא קיים:** ישות סניף עם יכולות (מדידה / איסוף / החזרה), סניף של ברקוד (פריט פיזי), הקלדה מהירה לרצף ברקודים, חישוב צרכים לפי סניף, התראת העברה בלו"ז / בראש הדף, התראה בסריקת החזרה, הצגת הסניף בכרטיס ההזמנה (בכרטיס A5 אין היום שום הצגה של `branch`).

## 2. מודל נתונים מוצע

### 2.1 בלי טבלה חדשה - הגדרות (`SystemSetting`)
| מפתח | ערך | הערה |
|---|---|---|
| `multi_branch_enabled` | `true` / `false` | **ברירת מחדל כבוי.** מפעיל את כל ההרחבות החדשות. `branches_enabled` ושאר ההגדרות הקיימות לא משתנות |
| `branches_config` | JSON `{"v":1,"branches":[{"id","name","isMain","measure","pickup","return","active"}]}` | רשימת הסניפים עם היכולות. המזהה `id` יציב גם אם משנים שם (שינוי שם לא שובר הזמנות קיימות - ראו 2.3) |
| `branch_list` | `שם1, שם2` | **משתקף אוטומטית** מ-`branches_config` בכל שמירה (סניפים פעילים בלבד), כך שכל הקוד הקיים (טפסי הזמנה, לו"ז, רשימת הזמנות) ממשיך לעבוד בלי שינוי |
| `branch_transfer_banner_enabled` | `true` / `false` (ברירת מחדל כבוי) | פס "יש להעביר פריטים" בראש הדף, מתחת לשורת התפריט |
| `branch_transfer_banner_scope` | `transfer` / `return` / `both` (ברירת מחדל `both`) | מה מופיע בפס: פריטים שצריך **להעביר** לסניף אחר לפני אירוע, ו/או פריטים שצריך **להחזיר** לסניף אחר |
| `branch_transfer_horizon_days` | מספר ימים (ברירת מחדל 14, ריק = 14) | **טווח אחד** להתראת ההעברה: הפס בראש הדף, שבבי "להעביר" ברשימת ההכנה והחישוב (אין הגדרה נפרדת "ימים לפני האירוע"). נערך בחלון **"הגדרות תהליכים" של הלו"ז** (כרטיס "התראת העברה בין סניפים", רק כשהריבוי דלוק) ובסעיף "לו״ז - טווחי הכנה, איסוף ועוד" בהגדרות. בלי שורה = 14 |
| `branch_return_alert_enabled` | `true` / `false` (ברירת מחדל `true` כשהריבוי דלוק) | חלון ההתראה בסריקת החזרה |
| `reserve_return_alert_enabled` | `true` / `false` (ברירת מחדל כבוי) | **לא תלוי בסניפים.** בסריקת החזרה של פריט רזרבה שיצא באישור: התראה "להחזיר לרזרבה". הסימון "יצא מהרזרבה" נכתב ב-`rentals/confirm` (עמודה `DressItem.locationBeforeRental`, רק כשההגדרה דלוקה וגם `allow_renting_reserve_items` כבוי = יציאה באישור מנהל) ומתנקה בהחזרה |

אין צורך ב-DDL או בזריעה כדי שההגדרות יעבדו: `POST /api/settings` עושה upsert. שורה חסרה = כבוי.

### 2.2 שתי עמודות חדשות ב-`DressItem` (**דורש DDL**)
סניף נוכחי של הפריט הפיזי (ברקוד). `String?`, ריק = "לא שויך" (נחשב כסניף הראשי בחישובים, ראו החלטה פתוחה #1) + אינדקס. `locationBeforeRental String?` - סימון פריט רזרבה שיצא באישור (ראו `reserve_return_alert_enabled`). הסיבה שזו עמודה ולא מחרוזת בתוך `location`: `location` נדרס ל"חנות" / "מושכר" בכל השכרה והחזרה, והסניף חייב לשרוד את זה.

```sql
ALTER TABLE "DressItem" ADD COLUMN IF NOT EXISTS "branch" TEXT;
CREATE INDEX IF NOT EXISTS "DressItem_branch_idx" ON "DressItem"("branch");
ALTER TABLE "DressItem" ADD COLUMN IF NOT EXISTS "locationBeforeRental" TEXT;
```
הסקריפט המוכן: `scripts/branches-ddl.sql` (+ `scripts/apply_branches_ddl.js`, בודק host לפני כתיבה, ברירת מחדל dry-run). **לא הורץ על פרודקשן** - צריך אישור הרכז / הבעלים, והוא חייב לרוץ על שני המסדים לפני שהקוד עולה (ראו 5).

### 2.3 סניף בהזמנה
`Order.branch` (סניף ביצוע) ו-`Order.pickupBranch` קיימים ונשארים מחרוזות עם **שם** הסניף. הצורך בחישוב = `pickupBranch || branch` (אותו כלל כמו הלו"ז). שינוי שם סניף בהגדרות לא משנה הזמנות קיימות; לכן ב"עריכת סניף" השם נעול אחרי שיש הזמנות / פריטים שמשויכים אליו (אפשר להשבית ולהוסיף חדש). אין מחיקה קשה - רק השבתה ("מחיקה רכה").

## 3. השלבים

**שלב א - סניפים בהגדרות.** `lib/branches.js` (לוגיקה טהורה + בדיקות), `GET/PUT /api/branches` (הנהלה ראשית / מתכנת; ולידציה: שם ייחודי, ראשי יחיד בין הפעילים), מסך `/admin/branches` (הוספה / עריכה / השבתה, ראשי, מתגי מדידה / איסוף / החזרה, ההגדרות הכלליות והתראות), חיבור לקבוצת "סניפים" בהגדרות (העיצוב החדש + הישן). בטפסי הזמנה: סניף איסוף מוגבל לסניפים עם "איסוף", ברירת המחדל = הסניף של המחשב (נבחר פעם אחת) או הראשי.

**שלב ב - מיקום ברקוד + חלונית הקלדה מהירה.** `DressItem.branch`; בכרטיס הדגם: עמודה / שדה "סניף" בפריט (כשהריבוי דלוק); `POST /api/dresses/items/relocate` (פריט אחד בכל בקשה: תוצאה לכל סריקה, ברקוד לא מוכר לא עוצר את הרצף, מחזיר מצב קודם ל-undo); חלונית צפה `QuickTransferDialog` עם מצבים: שיוך לסניף / העברה למחסן / מהמחסן (לסניף) / לרזרבה / למחסן לפי מספר קרטון (המספר נקלט פעם אחת ואז רצף). **מרחיב את הקיים** (`location` + `cartonNumber` של `DressItem`, אותם ערכים `מחסן` / `רזרבה` / `חנות`, אותה הרשאה - `feature:dress_items_manage` או פריט קטלוג חדש `feature:item_transfer`). היסטוריה - תוסף ה-audit של Prisma (אין כתיבת AuditLog ידנית).

**שלב ג - סניף ההזמנה וחישוב צרכים.** הצגת סניף הביצוע / האיסוף בכרטיס ההזמנה (A5 + הישן) ובטפסי ההזמנה החדשה (ברירת מחדל = סניף המחשב / הראשי; בריבוי סניפים הסניף נשמר תמיד). `lib/branches/needs.js` - חישוב טהור: הזמנות עתידיות שטרם נלקחו ← ביקוש לפי (דגם, מידה) בכל סניף מול היצע (פריטים בחנות, לפי סניף נוכחי) ← רשימת העברות `מ-A ל-B` לפני האירוע (פריט ספציפי לפי ברקוד כשהוא ידוע). בלו"ז, בשלב "הכנה": שבב "להעביר X מסניף A ל-B" בשורה. **מרחיב** את `dressLocationAlerts` (הוא ממשיך לעבוד כמו קודם; בריבוי סניפים הוא קורא את `DressItem.branch` במקום לחפש מילה ב-`location`).

**שלב ד - התראות.** (א) פס בראש הדף מתחת לתפריט (A5: `NoticeBar`; מעטפת ישנה: פס קטן) לפי ההגדרות של 2.1, עם הפריטים להעברה / להחזרה; (ב) סריקת החזרה: `POST /api/returns/scan` מחזיר `branchAdvice` כשהפריט צריך לעבור לסניף אחר, חלון התראה גלובלי (`BranchReturnAlertHost`) שנסגר ב-Enter (הסריקה הבאה ממשיכה בלי עכבר) ונרשם ב`Notification` (הפעמון ליד הפרופיל). נקודת החיבור ל-quick-barcode: `notifyReturnToOtherBranch(...)` ב-`lib/branches/returnAlert.js` + האזנה לאירוע `gm:branch-return-advice` (אין צורך לגעת בזרימת הסריקה עצמה).

## 4. החלטות פתוחות לבעלים
1. פריט ללא סניף (`DressItem.branch` ריק) - לראות אותו כשייך לסניף הראשי? (בקוד: כן.)
2. **הוחלט (12.10):** הקלדה מהירה להעברה - "כל מי שיש לה הרשאות מלאי": `page:dresses_catalog` (קטלוג שמלות; הנהלה ראשית ומתכנת תמיד) - בשרת `requireItemTransferAccess` (lib/dressItemAccess.js) ובכפתור (הכרטיס עצמו נפתח רק עם אותה הרשאה). קבוע אחד, `ITEM_TRANSFER_PERMISSION_KEY`, להחלפה (למשל ל-`page:orders`, השער של בדיקת מלאי). לא נוצרה הרשאה חדשה.
3. **הוחלט (12.10):** "מדידה" נשארת דגל מידע בלבד - אין שדה סניף מדידה בהזמנה.
4. **הוחלט (12.10):** התראת סריקת החזרה (לסניף אחר / לרזרבה) נרשמת כהודעה כללית בפעמון: כל מי שיש לה הרשאת מלאי (הנהלה כולל) + הסורקת, הודעה לכל נמענת, בלי כפילות (אותה כותרת ותוכן ב-24 שעות לא נוצרת שוב). אין שיוך עובד->סניף במערכת (החלטה B2 בלו"ז), לכן אין צמצום לפי סניף יעד; כשיהיה שיוך - לצמצם ב-`recipientsFor`.

## 5. בטיחות ופריסה
- **DDL לשני מסדי הייצור לפני שהקוד עולה** (כלל קבוע ב-CLAUDE.md): ברגע ש-`schema.prisma` כולל `DressItem.branch`, כל שאילתת `dressItem` בלי `select` מבקשת את העמודה, ובמסד שבלעדיה היא נופלת (P2022) גם כש-`multi_branch_enabled` כבוי. לכן הסדר הוא: DDL על שני המסדים, ורק אחריו מיזוג / פריסה.
- כתיבה רק מול TEST בפיתוח; בלי `prisma db push`.
- ההגדרות נכתבות לפי ה-org (code-fixes-vs-settings): הקוד עולה לשני הגמ"חים, ההפעלה בכל אחד בנפרד.

## 6. מימוש - מה נבנה בפועל (נקודות חיבור)
- **התראת החזרה (סעיף 7):** `POST /api/returns/scan` קורא ל-`buildReturnAdvices` (lib/returnBranchAdvice.js) אחרי שההחזרה נרשמה; כבוי = null בלי שאילתה; כשל לעולם לא מפיל החזרה. הסניף שבו נסרקה ההחזרה = העוגייה `gm_my_branch` (המחשב בוחר "באיזה סניף אני" פעם אחת - `MyBranchPrompt`, ואפשר לשנות בחלונית ההעברה המהירה). התשובה כוללת `branchAdvices`; הלקוח (`BranchReturnAlertHost`, מותקן במעטפת רק כשההגדרות דלוקות) עוטף את fetch ומציג חלון **לא גונב מיקוד** שנסגר ב-Enter (ואם כבר נסרק ברקוד הבא - ה-Enter עובר הלאה והסריקה נשמרת). ההודעה נרשמת ב-`Notification` של העובדת שסרקה (הפעמון בשתי המעטפות).
- **חיבור ל-quick-barcode:** אין צורך לשנות את זרימת הסריקה. אם הזרימה החדשה לא עוברת דרך `POST /api/returns/scan`: `import { notifyReturnToOtherBranch } from '@/app/components/branches/returnAlert'` וקריאה `notifyReturnToOtherBranch(advices)` עם אותו מבנה; ובשרת - `buildReturnAdvices({ barcode, dressItemId, actorId })`. נכון ליצירת המסמך ענף quick-barcode עדיין בלי commits.
- **פס בראש הדף (סעיף 6):** `BranchNotices` (מותקן ב-AppShell וב-MenuA5Shell לפי `branchNotices` מ-layout.js): A5 = `NoticeBar`, ישן = פס בתוך הדף. מקור הנתונים `GET /api/branches/needs` (העברות + "כשיוחזר - להעביר"); ההגדרות מתערכות ב-/admin/branches.
- **לו"ז:** בשלב "הכנה" שבב "להעביר ... מ-A ל-B" (`row.transfers`, `transferChip`), רק כש-`multi_branch_enabled`. החישוב על ה-horizon של `branch_transfer_horizon_days` (ברירת מחדל 14 יום מהיום) - לו"ז של יום רחוק יותר לא יציג שבבים.

## 7. לו"ז - "הגדרות תהליכים" (שוחזר 12.10.2026)
נמצא: החלון "הגדרות תהליכים" קיים **רק בעיצוב המאושר של הלו"ז** (`תצוגות-עיצוב/סיימתי-לעבוד/לוז-יומי.html`, `openSettings`, גלגל שיניים, הנהלה ראשית בלבד - החלטה B3). בקוד החי לא נבנה: לחצן הגלגל (`ScheduleToolbarSlots`) לא חובר, והמפתחות `schedule_stage_<שלב>_{enabled,days,shift}` נקראים ב-`lib/schedule/settings.js` אבל שום דבר לא כותב אותם. בסימולציית ההגדרות (`הגדרות-סימולציה.html`, `הגדרות-טבלה.html` והארטיפקטים שלהן) אין קבוצת לו"ז. שוחזר: `ScheduleSettingsDialog` (גלגל השיניים ו-`/schedule?settings=1`), `GET/PUT /api/schedule/settings` (כתיבה: הנהלה ראשית), `lib/schedule/stageSettings.js`, וסעיף "לו״ז - טווחי הכנה, איסוף ועוד" במסך ההגדרות (שורת קישור + שורות `schedule_stage_*` כשקיימות).
