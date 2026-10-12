# קטלוג המיילים ומרכז המיילים (2026-10-12)

מסמך זה מרכז (1) מיפוי מלא של כל המיילים שהמערכת שולחת, (2) איך עובד "מרכז המיילים" (`/admin/email-center`) שנבנה מעליהם, (3) אחסון, תזמון ומגבלות, (4) בטיחות שליחה, (5) מה נמצא לגבי הגדרות המייל ש"נעלמו".
מקורות האמת בקוד: [lib/emailCatalog.js](../lib/emailCatalog.js) (מי שולח / למי), [lib/emailRegistry.js](../lib/emailRegistry.js) (מה ניתן לערוך, ברירות המחדל, משתנים, תזמון), [EMAILS.md](../EMAILS.md) (הספרייה האחידה).

## 1. מיפוי כל המיילים

כל מייל יוצא דרך נקודה אחת: `postToMailer` ב-[lib/mailer.js](../lib/mailer.js) (Google Apps Script). נבדק: אין `fetch` ישיר לסקריפט בשום מקום אחר באתר.
"עריכה" = מה אפשר לערוך במרכז המיילים. "הפעלה" = מה שולט בשליחה. "תזמון" = מתי נשלח ומה אפשר לשנות.

### מיילים ללקוחות

| # | מזהה | מתי נשלח היום | למי | נושא (ברירת מחדל) | תבנית | הפעלה | תזמון (מה אפשר) | עריכה | קוד השליחה |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `orderCard` | כפתור "מייל הזמנה/השכרה" בהדפסה (עובד מורשה) | מייל הלקוח (ניתן לעריכה לפני שליחה) | הזמנה #N - גמ"ח שמלות | `renderOrderCardEmailHtml` + PDF | תמיד (לפי פעולה) | מיד בלבד | נושא + 9 שורות | `app/api/orders/[id]/email/route.js` |
| 2 | (מייל מהיר) | "מייל מהיר" מכרטיס הזמנה (`order_quick_mail_enabled`) | כתובת שהוקלדה | מוקלד | `renderGenericEmailHtml` | `order_quick_mail_enabled` | מיד בלבד | שדות קבועים בלבד | אותו קובץ (`body.quick`) |
| 3 | `managerFreeText` | "שלח מייל" מכרטיס לקוח/עובד (עם אימות סיסמה) | כתובת שהוקלדה (+עותק) | מוקלד | `renderGenericEmailHtml` | תמיד (לפי פעולה) | מיד בלבד | תגית + שדות קבועים | `app/api/send-email/route.js` |
| 4 | `orderCreatedAuto` | הזמנה חדשה נשמרה | מייל הלקוח | הזמנה #N - <שם הגמ"ח> | `renderOrderConfirmationEmailHtml` ([lib/orderConfirmationMail.js](../lib/orderConfirmationMail.js)) | `auto_email_on_order_create` | **מיד** (ברירת מחדל) או **אחרי X ימים מיצירת ההזמנה** (cron יומי) | נושא + 22 שורות (כולל בלוק משלוח) | `app/api/orders/route.js` + `app/api/cron/daily/route.js` |
| 5 | `pickupReminder` | cron יומי: אירוע מחר | מייל הלקוח | תזכורת איסוף - הזמנה #N - <גמ"ח> | `renderPickupReminderEmailHtml` | `pickup_reminder_enabled` | **X ימים לפני האירוע**, עד 5 תזכורות (למשל 7 ו-1); 0 = ביום האירוע | נושא + 10 שורות | `app/api/cron/daily/route.js` |
| 6 | `lateReturnReminder` | cron יומי: איחור בהחזרה, פעם אחת להזמנה | מייל הלקוח | תזכורת החזרה - הזמנה #N | `renderLateReturnEmailHtml` | `late_return_email_enabled` | **X ימים אחרי תאריך ההחזרה** (= `late_return_threshold_days`, אותה הגדרה) | נושא + 8 שורות (הטקסט המרכזי = `late_return_email_text`) | `app/api/cron/daily/route.js` |
| 7 | `bulkEventDate` | `/admin/bulk-email`: הודעה ללקוחות עם אירוע בטווח | לקוחות עם אירוע בטווח | מוקלד + [bulk-…] | `renderGenericEmailHtml` + כפתור אישור קבלה | `bulk_email_by_event_date` | מיד | תגית + כיתוב כפתור | `app/api/bulk-email/route.js` |
| 8 | `refundExecuted` | זיכוי סומן "בוצע" | מייל הלקוח / מייל הבקשה | אישור ביצוע זיכוי - מערכת הגמ"ח | `renderRefundExecutedEmailHtml` | דגל חדש (override) במרכז המיילים | מיד בלבד | נושא + 9 שורות | `app/api/refunds/[id]/route.js` |
| 9 | **דיוור** (חדש) | מרכז המיילים > דיוורים | לקוחות עם `marketingConsent=true` בלבד | מוקלד | `renderCampaignEmailHtml` | יוצר ידנית | מיד / מתוזמן (תאריך עברי + שעה) | כל התוכן | `lib/emailCampaign.js` |

### דוחות והודעות להנהלה / פנימי / משלוחים

| # | מזהה | מתי נשלח | למי | נושא | הפעלה | תזמון | עריכה | קוד |
|---|---|---|---|---|---|---|---|---|
| 10 | `dailyManagerReport` | cron יומי | `daily_manager_report_email` או `main_email` | דוח יומי <תאריך> - N הזמנות חדשות אתמול, M עם אירוע היום (**הנושא האמיתי; הרשומה הישנה בקטלוג הייתה שגויה ותוקנה**) | `daily_manager_report_enabled` | פעם ביום | נושא + 4 כותרות | `app/api/cron/daily/route.js` ([renderDailyManagerReport](../lib/emailTemplates.js)) |
| 11 | `manualBarcodesReport` | cron יומי, רק כשיש ברקודים ידניים | כנ"ל | ברקודים ידניים <תאריך> - N | `manual_barcode_daily_report` | פעם ביום | נושא + 5 שורות | אותו cron |
| 12 | `internalMessageAlert` | הודעה פנימית | נמען / כל מי שסימן `receiveEmailAlerts` | כותרת ההודעה | דגל חדש (override) | מיד | 3 שורות | `app/api/notifications/route.js` |
| 13 | `courierDeliveries` | "הדפסת משלוחים" > שליחה במייל | `courier_email` | כותרת הקבוצה / "נתוני משלוחים - N קבוצות" | לפי פעולה | מיד | נושא (כמה קבוצות) + 6 שורות | `app/api/deliveries/courier-email/route.js` |

### איפוס סיסמה (תמיד פעיל)

| # | מזהה | מתי | למי | נושא | עריכה | קוד |
|---|---|---|---|---|---|---|
| 14 | `passwordResetSelf` | "שכחתי סיסמה" | העובד | איפוס סיסמה - מערכת הגמ"ח | נושא + 10 שורות (הסיסמה תמיד בתיבה, לא ניתנת להסרה) | `app/api/auth/forgot-password/route.js` |
| 15 | `passwordResetManager` | מנהל מאפס סיסמה | העובד | כנ"ל | כנ"ל | `app/api/employees/[id]/reset-password/route.js` |

### מיילים טכניים (מוצגים לעיון ולתצוגה מקדימה; נעולים לעריכה)

| # | מזהה | מתי | למי | הערה |
|---|---|---|---|---|
| 16 | `errorReportNew` | דיווח תקלה | מתכנתים | הנושא והגוף נקראים ע"י הסוכן האוטומטי (בלוק AI_DATA) |
| 17 | `errorReportHumanRequested` | "מענה אנושי" | מתכנתים | |
| 18 | `agentDigest` | cron פעמיים ביום (גמ"ח ראשי) | מתכנתים | `agent_digest_email_enabled` |
| 19 | `policyQuestionnaireSubmitted` | הגשת שאלון מדיניות | מתכנתים | |
| 20 | כשל גיבוי | GitHub Actions | מתכנתים + סוד | `scripts/lib/backupAlert.js` - מחוץ לאתר, נשאר קבוע |

**מיילי קיוסק / הרשמה:** כיום אין אף מייל שנשלח מעמדת הלקוח / ההרשמה (נבדק). אם סוכן ההסכמות/קיוסק יוסיף כזה: רשומה ב-`emailCatalog.js` + `emailRegistry.js`, שליחה דרך `sendSystemEmail`, וקריאה ל-`getEmailConfig(id)` כמו האתרים האחרים.
**רשימת תפוצה (`mailing_list_auto_sync`):** רושם שורה פנימית ב-`EmailLog` בלבד, לא שולח מייל.

## 2. מרכז המיילים - `/admin/email-center`

מסך בעיצוב "הגדרות מערכת" (סרגל לשוניות בימין, באנרים, רכיבי הפלטה). גישה: הנהלה ראשית / מתכנת (`app/admin/layout.js` + `checkAuth('הנהלה ראשית')` בכל API). נכנס מהיצמד "ניהול" (אריח "מרכז המיילים"), ומשורת קישור בהגדרות מערכת > אוטומציה.

- **מיילים:** רשימה לפי קטגוריות, מתג הפעלה/כיבוי, ועורך לכל מייל: נושא ושורות בצורת "דברי דואר" - שדות מוחלפים (`{{customerName}}`, `{{orderId}}`...) מופיעים כצ'יפים בתוך הטקסט, אפשר לגרור, למחוק (×) ולהוסיף (לחיצה בפלטה או גרירה); תצוגה מקדימה חיה (iframe ללא סקריפטים) עם נתוני דוגמה; "חזרה לברירת מחדל" לכל שורה ולמייל כולו.
- **נתונים קבועים:** שם הגמ"ח, כתובת, טלפון, מייל ליצירת קשר, שם השולח, לוגו (מתג), "בס"ד", שורת סיום, חתימה. לכל שדה: ערך, ברירת מחדל (הגדרת האתר של הגמ"ח הזה), ואיפוס.
- **תזמון (בעורך כל מייל):** יחסית להזמנה (מיד / אחרי X ימים), יחסית לאירוע (X ימים לפני), יחסית להחזרה (X ימים אחרי). אפשרות שאינה רלוונטית למייל מוצגת באפור עם הסבר.
- **דיוורים:** ר' סעיף 4.
- **בדיקה ויומן:** קישורים ל-`/admin/email-test`, ליומן המיילים, להגדרות, ותיאור ריצות ה-cron.

### אחסון (בלי שינוי סכמה)

`SystemSetting` קיים, שורות בלי `category` (לא מופיעות במסכי ההגדרות):

| מפתח | תוכן |
|---|---|
| `email_tpl:<emailId>` | JSON `{enabled?, subject?, texts?:{key:text}, schedule?:{days, orderAfterDays}, updatedAt, updatedBy}` - רק מה שנערך. אין שורה = ברירת מחדל = ההתנהגות הקיימת בדיוק |
| `email_fixed_fields` | JSON `{values:{gmachName?, gmachAddress?, ...}}` - רק עקיפות. איפוס מוחק את העקיפה; **הגדרות האתר (`gmach_name` וכו') לא משתנות**, ולכן שני הגמ"חים לא מתערבבים |
| `email_campaign:<id>` | מסמך דיוור (תוכן, נמענים כמזהי לקוח, התקדמות) |

מתגי הפעלה וימים שכבר קיימים כהגדרה (`pickup_reminder_enabled`, `late_return_email_enabled`, `late_return_threshold_days`, `auto_email_on_order_create`, `daily_manager_report_enabled`, `manual_barcode_daily_report`, `bulk_email_by_event_date`, `agent_digest_email_enabled`) נכתבים לאותה הגדרה - אין "מתג שני". הגדרה שחסרה ב-DB נוצרת בלחיצה (שם עברי + קטגוריה "אוטומציה"), כך שהיא מופיעה גם בהגדרות מערכת.

**אין צורך בטבלה חדשה.** תמונות וצרופות של דיוורים נשמרות בטבלת `Attachment` הקיימת.

### החיבור לאתרי השליחה

כל תבנית ב-`lib/emailTemplates.js` מקבלת פרמטר רשות `cfg = {texts, fixed}` (מ-`getEmailConfig(id)` ב-`lib/emailConfig.js`). בלי `cfg` הפלט **זהה בייט-בבייט** לגרסה הישנה (`scripts/email-center-tests/templates-parity.test.mjs`, מול העתק קפוא של התבניות הישנות). `emailSubject(id, params, cfg)` מחליף את הנושא. `getEmailConfig` לא זורק לעולם (כשל מסד = ברירות מחדל), כדי שמייל איפוס סיסמה לא ייפגע. כשהמייל נערך, גם גרסת הטקסט הפשוט נגזרת מה-HTML (`cfgPlain`).

### הערות על שינויים בקוד קיים

- `app/api/orders/route.js`: הלוגיקה של אישור ההזמנה הועברה ל-`lib/orderConfirmationMail.js` (תוכן זהה) כדי שגם ה-cron ישתמש בה ל"אחרי X ימים".
- `app/api/cron/daily/route.js`: תזכורת איסוף לפי רשימת ימים (ברירת מחדל [1] = כמו קודם); הדוח היומי בנוי ב-`renderDailyManagerReport`, **ושמות הלקוחות בו עוברים escape** (קודם נכנסו ל-HTML כמו שהם); בלוק אישור הזמנה מתוזמן; הרצת דיוורים מתוזמנים בסוף.
- `lib/mailer.js`: מצב `EMAIL_DRY_RUN=1`, שם שולח מהשדות הקבועים, `requestId` קבוע (אידמפוטנטיות), `getMailerQuota`.
- `lib/emailCatalog.js`: נושא הדוח היומי תוקן; `emailSubject` מקבל `cfg`.
- בלוק משלוח באישור הזמנה (לבקשת הבעלים; הלוגיקה בענף `order-docs-delivery`): התבנית מקבלת `delivery={outbound,return,outHours,returnHours}`; שורות `lblDeliveryOut` / `lblDeliveryBack` / `deliveryNotice` (עם `{{deliveryOutHours}}`, `{{deliveryReturnHours}}`) ניתנות לעריכה במרכז המיילים. החיבור אחרי מיזוג: `sendOrderConfirmationEmail(order, { emailCfg, delivery: buildDeliverySection(order) })` בשני אתרי הקריאה (`orders/route.js`, `cron/daily`).

## 3. תזמון - מה מומש ומה מוגבל

| אפשרות | מימוש |
|---|---|
| מיד | ברירת מחדל לכל המיילים שנשלחים בעקבות פעולה |
| אחרי X ימים מיצירת ההזמנה | `orderCreatedAuto` בלבד: ה-cron היומי שולח להזמנות שנוצרו לפני X ימים (פעם אחת להזמנה לפי `EmailLog`; לא טיוטה/שריון) |
| X ימים לפני האירוע | `pickupReminder` (כמה תזכורות); ה-cron היומי |
| X ימים אחרי האירוע/ההחזרה | `lateReturnReminder` (אחרי תאריך ההחזרה הצפוי) |
| שעה ביום / X דקות אחרי | **לא נתמך**: Vercel מריץ cron אחד ביום (~08:30 שעון ישראל) + שני cronים של סוכן הענפים (~17:30, ~00:30). לא הוספנו תשתית תורים. ההגדרות הישנות `pickup_reminder_hour` / `daily_manager_report_hour` **אינן נקראות בקוד** (הן היו כך גם לפני) |
| דיוור מתוזמן (תאריך עברי + שעה) | **שעה מדויקת בדפוס הצינתוקים של print-center**: מתזמן Google Apps Script ([docs/gas-campaign-scheduler.gs](gas-campaign-scheduler.gs)) - בעת התזמון האתר רושם אצלו טריגר חד-פעמי, ובדקה שנבחרה הוא קורא פעם אחת ל-`/api/cron/email-campaigns` (Bearer `EMAIL_SCHEDULER_SECRET`); המשך אוטומטי בעוד דקה לדיוור גדול; ניסיונות חוזרים בכשל. claim אטומי (compare-and-swap) מונע שליחה כפולה. **דורש הפעלה חד-פעמית** (סקריפט + `EMAIL_SCHEDULER_URL/SECRET` ב-Vercel, ר' [email-center-followups.md](email-center-followups.md)); בלעדיה - נשלח בהרצת ה-cron הקרובה (~08:30 / ~17:30 / ~00:30) |

### איך מתוזמנים הצינתוקים היום (ממצא, ועליו הדפוס)
במערכת print-center (`C:\wt\wt-tts-voice`, `lib/scheduledBroadcast.js`; פרויקט Apps Script נפרד `apps-script-scheduler`, מחוץ לריפו): הרב קובע בטלפון שידור מתוזמן -> נשמרת שורה `ScheduledBroadcast` + האתר שולח למתזמן `{secret, action:'schedule', id, runAt}` -> Apps Script יוצר טריגר חד-פעמי לאותה שעה (נמדד: איחור של ~16 שניות) -> בשעה הזו קורא פעם אחת ל-`/api/cron/scheduled-broadcasts` (Bearer `CRON_SECRET`/`SCHEDULER_SECRET`) -> `runDueScheduledBroadcasts` תופס שורה ב-`updateMany` אטומי ומריץ. רשתות ביטחון: כל בקשת webhook טלפונית וה-cron היומי של Vercel. אין GitHub Actions ואין שירות cron חיצוני אחר. שיפורים שהוספנו אצלנו: הסוד ורשימת האתרים המותרים ב-Script Properties (בטבלת המקור הסוד כתוב בקוד), סקריפט אחד לשני הגמ"חים, והמשך אוטומטי לדיוור גדול.

## 4. דיוורים - בטיחות ומגבלות

- **רק מאשרי דיוור:** `marketingConsent=true`, לא מחוק, מייל תקין. נבדק שוב **בכל שליחה** (הסכמה שבוטלה באמצע = דילוג).
- **הסרה:** כל מייל כולל קישור אישי `/api/email/unsubscribe?t=<טוקן>` (HMAC של מזהה הלקוח עם `AUTH_SECRET`; בלי טבלה) ושורת זיהוי השולח. GET מציג כפתור, POST מבטל (`marketingConsent=false`, נרשם ב-AuditLog). תשובה זהה לטוקן שגוי. כשל ב-`AUTH_SECRET` = אין שליחה. **בהמשך:** חיבור ליומן ההסכמות (`CustomerConsent`, סוכן ההסכמות) כשימוזג.
- **הכתובות לא נחשפות:** הדפדפן מקבל שם, עיר וכתובת מסוכה; בחירה ידנית רק ממאשרי דיוור.
- **גוף:** טקסט בלבד (`renderRichText`: escape מלא + `**הדגשה**` + `[קישור](https://…)` בטוח). אין HTML משתמש. תמונה: `sharp` (JPEG, עד 1600px), מוגשת מ-`/api/attachment/<uuid>`. צרופות: רשימת סיומות סגורה, עד 5, 3MB לקובץ, 6MB סה"כ.
- **הרשאות:** שליחה דורשת עובד **מחובר בפועל** בתפקיד הנהלה ראשית/מתכנת (גם כשחובת ההתחברות כבויה). קצב מוגבל (6 דיוורים בשעה, 10 בדיקות ב-10 דקות, 200 חתיכות בדקה). עד 500 נמענים לדיוור.
- **מכסת Gmail:** 100 נמענים ליום לחשבון (משותף לכל המערכת). לפני שליחה נבדקת המכסה (`getMailerQuota`); כשנגמרה השליחה נעצרת וממשיכה בהרצה הבאה. **זו מגבלה מהותית לדיוורים גדולים.**
- **אידמפוטנטיות:** `requestId` קבוע לכל נמען - ה-Apps Script לא שולח פעמיים באותן 6 שעות.
- **לא קיים:** כותרת `List-Unsubscribe` (Apps Script לא מאפשר), מעקב פתיחות/קליקים, תבניות דיוור שמורות, רשימות נמענים שמורות, A/B.

## 5. בטיחות שליחה בבדיקות

`EMAIL_DRY_RUN=1` ב-`.env.local` של סביבת הפיתוח: `postToMailer` לא פונה לרשת; המייל נרשם בתיבת יציאה בזיכרון (`/api/admin/email-center/outbox`, 404 בפרודקשן). בפרודקשן המשתנה לא מוגדר.

## 6. הגדרות המייל ש"נעלמו" - ממצאים

1. **לא נמחקו. הועברו.** ב-4.10.2026 (commit `97d8ece9`, מסכי ההגדרות החדשים "סימולציה") הקטגוריה "אוטומציה" מופתה ללשונית **"הודעות"** (`CATEGORY_TAB`), והלשונית "אוטומציה" נשארה עם "גיבוי אוטומטי" בלבד (ובכלל לא מוצגת בלי שורות גיבוי). לכן התזכורות / אישור הזמנה / מייל למאחרים / דוח יומי / רשימת תפוצה / עדכון ענפים נראו כמי שנעלמו. **תוקן:** הסעיפים חזרו ללשונית "אוטומציה" (`lib/settingsSimLayout.js`), ובראש הסעיף יש שורת קישור למרכז המיילים. "הודעות" נשארה עם ההודעות הפנימיות.
2. **שורות שלא קיימות ב-DB לא מוצגות בשום מסך** (גם הישן וגם החדש מציגים רק מה שקיים ב-`SystemSetting`). בבדיקה מול DB הבדיקות: קיימות `pickup_reminder_*`, `late_return_*`, `auto_email_on_order_create`, `bulk_email_by_event_date`, `mailing_list_*`, `agent_digest_*`, `daily_manager_report_email`, `email_link_a/b`, `email_routing_strategy`; **חסרות**: `daily_manager_report_enabled`, `manual_barcode_daily_report`, `order_quick_mail_enabled`, `courier_email`/`courier_name` (בפרודקשן לא נבדק - לא נגענו). הקוד קורא אותן וחסר = כבוי. הפתרון: מתג במרכז המיילים יוצר את השורה, או `node scripts/seed_email_center_settings.js --org=N` (dry-run, יוצר 'false' אם חסר - בדיוק ההתנהגות הנוכחית).
3. **הגדרות השולח/ניתוב (`email_link_a/b`, `email_routing_strategy`, `email_drive_folder_id`)** בקטגוריה "מיילים" - **למתכנת בלבד** (`/admin/site-settings`, לשונית "מיילים"); הנהלה ראשית לא רואה אותן (כך גם בישן). שם השולח נקבע מ-`gmach_name` או מ"שם השולח" במרכז המיילים.
4. **מתים:** `pickup_reminder_hour`, `daily_manager_report_hour` - מוצגות כהגדרה אבל אף קוד לא קורא אותן; השעה נקבעת ב-`vercel.json`.
