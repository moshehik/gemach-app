// lib/emailRegistry.js - הגדרת "מה ניתן לערוך" בכל מייל, למרכז המיילים (/admin/email-center). טהור (בלי Prisma/next).
//
// lib/emailCatalog.js נשאר מקור האמת ל"אילו מיילים יש" (מי מפעיל, נמענים, קבצי מקור). כאן נוסף מה שנדרש לעריכה:
//   * subject  - תבנית הנושא (עם {{משתנים}}) - חייבת להפיק בדיוק את אותו נושא כמו emailCatalog (נבדק ב-scripts/email-center-tests).
//   * lines    - השורות הניתנות לעריכה (key + ברירת מחדל). ברירת המחדל כאן זהה אות באות למה שהיה כתוב בתבניות עד היום,
//                ולכן שורה חסרה במסד = המייל יוצא בדיוק כמו קודם (נבדק מול הגרסה הישנה של התבניות).
//   * vars     - המשתנים שמותר לכתוב בשורות של המייל הזה, עם דוגמה לתצוגה מקדימה. {{gmachName}} / {{gmachAddress}} / {{gmachPhone}} תמיד זמינים.
//   * enabled  - איך מכבים את המייל: 'setting' (אותה הגדרה קיימת שהקוד בודק היום - לא נוצר מתג שני), 'override' (דגל חדש
//                בשורת התצורה), 'always' (נשלח רק כשמשתמש/תהליך מבקש - אין מתג כללי), 'locked' (לעולם לא מכבים: איפוס סיסמה, מיילים למתכנת).
//   * schedule - מתי נשלח ומה אפשר לבחור (ר' SCHEDULE_NOTE בסוף).
//   * editable - false = מייל טכני (מתכנת/סוכן אוטומטי): מוצג ונבדק בתצוגה מקדימה אבל לא נערך (בלוק AI_DATA, חיפושי נושא וכד' תלויים בו).
//
// התבניות (lib/emailTemplates.js) קוראות את הטקסטים דרך makeTx() למטה: מה שנשמר > ברירת המחדל כאן.

import { fillVars } from './emailText.js';

export const COMMON_VARS = Object.freeze([
  { key: 'gmachName', label: 'שם הגמ"ח', example: 'גמ"ח שמלות' },
  { key: 'gmachAddress', label: 'כתובת הגמ"ח', example: 'רחוב הדוגמה 1, ירושלים' },
  { key: 'gmachPhone', label: 'טלפון הגמ"ח', example: '02-1234567' },
]);

const V = {
  customerName: { key: 'customerName', label: 'שם הלקוח/ה', example: 'רחל כהן' },
  firstName: { key: 'firstName', label: 'שם פרטי', example: 'דנה' },
  orderId: { key: 'orderId', label: 'מספר הזמנה', example: '12345' },
  eventDate: { key: 'eventDate', label: 'תאריך האירוע', example: 'כז אלול תשפ"ו' },
  hebrewDate: { key: 'hebrewDate', label: 'התאריך העברי', example: 'כז אלול תשפ"ו' },
};

// ---------------------------------------------------------------------------
// שדות קבועים (טאב "שדות קבועים"): אותו ערך משמש את כל המיילים (כותרת, כותפת, שם השולח).
// default = מאיפה מגיעה ברירת המחדל כשאין עקיפה: 'setting' (הגדרת האתר הרגילה - שונה בין שני הגמ"חים) או ערך קבוע.
// "איפוס" מוחק את העקיפה, והמייל חוזר להשתמש בהגדרת האתר / בברירת המחדל. העקיפה לא נוגעת בהגדרות האתר עצמן.
// ---------------------------------------------------------------------------
export const FIXED_FIELDS = Object.freeze([
  { key: 'gmachName', label: 'שם הגמ"ח', hint: 'מופיע בכותרת הצבעונית של כל מייל, בכותפת ובשם השולח.', settingKey: 'gmach_name', fallback: 'גמ"ח שמלות', maxLength: 80 },
  { key: 'gmachAddress', label: 'כתובת', hint: 'מוצגת בכותפת ובמיילים שמזכירים איפה אוספים.', settingKey: 'gmach_address', fallback: '', maxLength: 160 },
  { key: 'gmachPhone', label: 'טלפון', hint: 'מוצג בכותפת ובמיילים שמזכירים ליצור קשר.', settingKey: 'gmach_phone', fallback: '', maxLength: 40, ltr: true },
  { key: 'contactEmail', label: 'כתובת מייל ליצירת קשר', hint: 'מוצגת בכותפת. ריק = לא מוצגת. (כתובת השליחה עצמה נקבעת בחשבון ה-Google של המערכת ואינה ניתנת לשינוי מכאן.)', settingKey: null, fallback: '', maxLength: 120, ltr: true },
  { key: 'senderName', label: 'שם השולח (כפי שמופיע בתיבת הדואר)', hint: 'הטקסט שמופיע ליד כתובת השולח בתיבת הדואר של הלקוחה. ריק = שם הגמ"ח.', settingKey: null, fallback: '', maxLength: 80 },
  { key: 'showLogo', label: 'הצגת הלוגו בכותרת המייל', hint: 'מציג את לוגו הגמ"ח (מ-הגדרות מערכת > מיתוג) בראש כל מייל. הלוגו נטען מכתובת האתר, ולכן מוצג רק כשהאתר נגיש לאינטרנט.', settingKey: null, fallback: '0', maxLength: 1, toggle: true },
  { key: 'blessing', label: 'שורת פתיחה בכותרת (בס"ד)', hint: 'השורה הקטנה מעל שם הגמ"ח. אפשר לרוקן כדי להסיר.', settingKey: null, fallback: 'בס"ד', maxLength: 40, allowEmptyOverride: true },
  { key: 'footerNote', label: 'שורת סיום בכותפת', hint: 'השורה האחרונה בתחתית כל מייל. אפשר להשתמש ב-{{gmachName}}.', settingKey: null, fallback: 'הודעה זו נשלחה אוטומטית ממערכת {{gmachName}}', maxLength: 200, allowEmptyOverride: true },
  { key: 'signature', label: 'חתימה (שורה נוספת בכותפת)', hint: 'למשל "בברכה, צוות הגמ"ח". ריק = אין חתימה.', settingKey: null, fallback: '', maxLength: 200 },
]);

export const FIXED_FIELD_KEYS = Object.freeze(FIXED_FIELDS.map((f) => f.key));

// ---------------------------------------------------------------------------
// הגדרת המיילים
// ---------------------------------------------------------------------------

const pw = (byManager) => ({
  editable: true,
  enabled: { type: 'locked', note: 'איפוס סיסמה נשלח רק כשמבקשים אותו - אי אפשר לכבות (המשתמש היה ננעל מחוץ למערכת).' },
  subject: { default: 'איפוס סיסמה - מערכת הגמ"ח', vars: [] },
  vars: [V.firstName, { key: 'contactLine', label: 'משפט יצירת קשר (מחושב: "או לפנות אלינו בטלפון…" כשיש טלפון, אחרת "ולפנות למנהל המערכת")', example: ' או לפנות אלינו בטלפון 02-1234567' }],
  lines: [
    { key: 'kicker', label: 'תגית בכותרת', default: 'איפוס סיסמה' },
    { key: 'title', label: 'כותרת', default: 'שלום {{firstName}}', vars: ['firstName'] },
    { key: 'lead', label: 'משפט פתיחה', default: byManager ? 'סיסמתך למערכת אופסה על ידי מנהל, ולהלן סיסמה זמנית לחיבור.' : 'קיבלנו בקשה לאיפוס הסיסמה שלך למערכת, ולהלן סיסמה זמנית לחיבור.', multiline: true },
    { key: 'codeLabel', label: 'כיתוב מעל הסיסמה', default: 'הסיסמה הזמנית שלך', hint: 'הסיסמה עצמה מוצגת תמיד בתיבה - היא אינה חלק מהטקסט הניתן לעריכה.' },
    { key: 'stepsTitle', label: 'כותרת השלבים', default: 'מה עושים עכשיו?' },
    { key: 'step1', label: 'שלב 1', default: 'נכנסים למערכת עם הסיסמה הזמנית שלמעלה.' },
    { key: 'step2', label: 'שלב 2', default: 'בכניסה הראשונה תתבקשו לבחור סיסמה חדשה משלכם.' },
    { key: 'step3', label: 'שלב 3', default: 'מתחילים לעבוד - והסיסמה הזמנית מפסיקה לעבוד.' },
    { key: 'warnTitle', label: 'כותרת האזהרה', default: 'לא ביקשתם איפוס?' },
    { key: 'warnText', label: 'טקסט האזהרה', default: 'אפשר להתעלם מהודעה זו{{contactLine}}.', vars: ['contactLine'], multiline: true },
  ],
  schedule: { modes: ['immediate'], note: 'נשלח מיד כשהעובד מבקש איפוס או כשמנהל מאפס.' },
});

export const EMAIL_REGISTRY = Object.freeze({
  passwordResetSelf: pw(false),
  passwordResetManager: pw(true),

  managerFreeText: {
    editable: true,
    enabled: { type: 'always', note: 'נשלח רק כשמנהל לוחץ "שלח מייל" - אין מתג כללי.' },
    subject: null, // הנושא מוקלד ע"י השולח
    vars: [],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'הודעה מהגמ"ח' },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשהמנהל לוחץ שליחה.' },
  },

  orderCard: {
    editable: true,
    enabled: { type: 'always', note: 'נשלח רק כשעובד לוחץ "מייל הזמנה" / "מייל השכרה" (בכפוף להרשאת feature:customer_email_approval).' },
    subject: { default: 'הזמנה #{{orderId}} - גמ"ח שמלות', vars: ['orderId'], note: 'כאן "גמ"ח שמלות" קבוע בקוד (כמו עד היום); אפשר להחליף ל-{{gmachName}}.' },
    vars: [V.orderId, V.customerName, V.eventDate, { key: 'docKind', label: 'סוג המסמך: הזמנה / השכרה', example: 'הזמנה' }, { key: 'docKindDef', label: 'סוג המסמך בידיעה: ההזמנה / ההשכרה', example: 'ההזמנה' }, { key: 'docTitle', label: 'שם המסמך: הזמנה / דוח השכרה', example: 'הזמנה' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'כרטיס {{docKind}}', vars: ['docKind'] },
      { key: 'title', label: 'כותרת', default: '{{docTitle}} #{{orderId}}', vars: ['docTitle', 'orderId'] },
      { key: 'lead', label: 'משפט פתיחה (כשיש שם לקוח/ה)', default: 'שלום {{customerName}}, מצורף כרטיס {{docKindDef}} שלך.', vars: ['customerName', 'docKindDef'], multiline: true },
      { key: 'leadNoName', label: 'משפט פתיחה (כשאין שם)', default: 'מצורף כרטיס {{docKindDef}}.', vars: ['docKindDef'], multiline: true },
      { key: 'lblNumber', label: 'תווית מספר', default: 'מספר {{docKind}}', vars: ['docKind'] },
      { key: 'lblName', label: 'תווית שם', default: 'על שם' },
      { key: 'lblEvent', label: 'תווית תאריך', default: 'תאריך האירוע' },
      { key: 'lblSigned', label: 'תווית: תקנון (מופיעה רק כשהלקוחה חתמה על התקנון בהזמנה)', default: 'תקנון' },
      { key: 'signedText', label: 'טקסט: חתימה על התקנון', default: 'חתם/ה על תקנון ההשכרה ✓' },
      { key: 'lblPickupAddress', label: 'תווית: כתובת האיסוף (רק בהזמנה שבה הלקוחה מגיעה לגמ"ח ויש קישור מפות)', default: 'כתובת האיסוף' },
      { key: 'mapsLabel', label: 'כיתוב קישור המפות', default: 'פתיחה במפות Google' },
      { key: 'calloutTitle', label: 'כותרת ההערה', default: 'המסמך המלא מצורף' },
      { key: 'calloutText', label: 'טקסט ההערה', default: 'כרטיס {{docKindDef}} המלא, כולל פירוט הפריטים, התיקונים והתשלומים, מצורף למייל כקובץ PDF.', vars: ['docKindDef'], multiline: true },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשהעובדת לוחצת שליחה.' },
  },

  orderCreatedAuto: {
    editable: true,
    enabled: { type: 'setting', key: 'auto_email_on_order_create', note: 'אותה הגדרה קיימת: "אישור הזמנה (מייל)" בהגדרות מערכת.' },
    subject: { default: 'הזמנה #{{orderId}} - {{gmachName}}', vars: ['orderId'] },
    vars: [V.customerName, V.orderId, V.eventDate,
      { key: 'deliveryNoticeAll', label: 'כיתוב "שימו לב" המלא כפי שנקבע בהגדרות המשלוחים (משפט + שורת שעות לכל כיוון בהזמנה; מופיע רק כשיש משלוח)', example: 'שימו לב: אם הזמנתם משלוח אין צורך לבוא לגמ"ח, והמשלוחן ייצור אתכם קשר.\nמשלוח הלוך: בשעות אחה"צ–ערב.\nמשלוח חזור: 10:00–13:00.' },
      { key: 'deliveryNoticeText', label: 'המשפט הכללי של "שימו לב" (הגדרה delivery_notice_text)', example: 'שימו לב: אם הזמנתם משלוח אין צורך לבוא לגמ"ח, והמשלוחן ייצור אתכם קשר.' },
      { key: 'deliveryOutHours', label: 'שעות משלוח הלוך (מההגדרות; ריק כשאין משלוח הלוך)', example: 'בשעות אחה"צ–ערב' },
      { key: 'deliveryReturnHours', label: 'שעות משלוח חזור (מההגדרות; ריק כשאין משלוח חזור)', example: '10:00–13:00' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'אישור הזמנה' },
      { key: 'title', label: 'כותרת', default: 'הזמנתך #{{orderId}} נקלטה בהצלחה', vars: ['orderId'] },
      { key: 'lead', label: 'משפט פתיחה (כשיש שם)', default: 'שלום {{customerName}}, תודה שבחרת בנו. ריכזנו כאן את כל הפרטים.', vars: ['customerName'], multiline: true },
      { key: 'leadNoName', label: 'משפט פתיחה (כשאין שם)', default: 'תודה שבחרת בנו. ריכזנו כאן את כל הפרטים.', multiline: true },
      { key: 'sectionOrder', label: 'כותרת: פרטי ההזמנה', default: 'פרטי ההזמנה' },
      { key: 'lblEvent', label: 'תווית: תאריך האירוע', default: 'תאריך האירוע' },
      { key: 'lblPickup', label: 'תווית: קבלת השמלות', default: 'קבלת השמלות' },
      { key: 'lblReturn', label: 'תווית: החזרת השמלות', default: 'החזרת השמלות' },
      { key: 'lblItems', label: 'תווית: פריטים', default: 'פריטים' },
      { key: 'lblSigned', label: 'תווית: תקנון (מופיעה רק כשהלקוחה חתמה על התקנון בהזמנה)', default: 'תקנון' },
      { key: 'signedText', label: 'טקסט: חתימה על התקנון', default: 'חתם/ה על תקנון ההשכרה ✓' },
      { key: 'noItems', label: 'כשאין פירוט פריטים', default: 'ללא פירוט' },
      { key: 'lblDeliveryOut', label: 'משלוח: שורת "הלוך" ברשימת הפריטים (רק כשיש משלוח הלוך)', default: 'משלוח הלוך' },
      { key: 'lblDeliveryBack', label: 'משלוח: שורת "חזור" ברשימת הפריטים (רק כשיש משלוח חזור)', default: 'משלוח חזור' },
      { key: 'lblDeliveryOf', label: 'משלוח: מילת הפירוט בסיכום התשלום ("מתוכם משלוח הלוך ₪60")', default: 'מתוכם' },
      { key: 'deliveryNotice', label: 'משלוח: בלוק "שימו לב" (מופיע רק כשיש משלוח בהזמנה)', default: '{{deliveryNoticeAll}}', vars: ['deliveryNoticeAll', 'deliveryNoticeText', 'deliveryOutHours', 'deliveryReturnHours'], multiline: true, hint: 'ברירת המחדל מגיעה מההגדרות delivery_notice_text / delivery_outbound_hours / delivery_return_hours (הגדרות מערכת > משלוחים) ומציגה רק את הכיוונים שבהזמנה. עריכה כאן מחליפה את כל הבלוק (אפשר לשלב {{deliveryOutHours}} / {{deliveryReturnHours}}).' },
      { key: 'sectionPay', label: 'כותרת: סיכום תשלום', default: 'סיכום תשלום' },
      { key: 'lblTotal', label: 'תווית: סה"כ לחיוב', default: 'סה"כ לחיוב' },
      { key: 'lblPaid', label: 'תווית: שולם', default: 'שולם' },
      { key: 'lblBalance', label: 'תווית: יתרה לתשלום', default: 'יתרה לתשלום' },
      { key: 'paidInFull', label: 'כשהכול שולם', default: 'שולם במלואו ✓' },
      { key: 'whereTitle', label: 'כותרת "איפה אנחנו"', default: 'איפה אנחנו' },
      { key: 'contactTitle', label: 'כותרת "פרטי קשר" (בהזמנת משלוח שהלקוחה לא מגיעה בה לגמ"ח - בלי כתובת)', default: 'פרטי קשר' },
      { key: 'mapsLabel', label: 'כיתוב קישור המפות', default: 'פתיחה במפות Google' },
      { key: 'whereAddress', label: 'שורת כתובת', default: 'כתובת האיסוף: {{gmachAddress}}', vars: ['gmachAddress'] },
      { key: 'wherePhone', label: 'שורת טלפון', default: 'טלפון: {{gmachPhone}}', vars: ['gmachPhone'] },
      { key: 'closing', label: 'משפט סיום', default: 'נשמח לראותך!', multiline: true },
    ],
    schedule: {
      modes: ['immediate', 'order_after'],
      maxDays: 30,
      note: 'ברירת מחדל: נשלח מיד בסיום יצירת ההזמנה. אפשר לבחור "אחרי X ימים מיצירת ההזמנה" - אז הוא נשלח מה-cron היומי (פעם ביום, ~08:30 שעון ישראל) ולא מיד.',
    },
  },

  pickupReminder: {
    editable: true,
    enabled: { type: 'setting', key: 'pickup_reminder_enabled', note: 'אותה הגדרה קיימת: "תזכורת מייל יום לפני איסוף" בהגדרות מערכת.' },
    subject: { default: 'תזכורת איסוף - הזמנה #{{orderId}} - {{gmachName}}', vars: ['orderId'] },
    vars: [V.customerName, V.orderId, V.eventDate, { key: 'whenWord', label: 'מתי (מחושב מהתזמון): היום / מחר / מחרתיים / בעוד N ימים', example: 'מחר' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'תזכורת איסוף' },
      { key: 'title', label: 'כותרת', default: '{{whenWord}} איסוף ההזמנה #{{orderId}}', vars: ['whenWord', 'orderId'] },
      { key: 'lead', label: 'משפט פתיחה (כשיש שם)', default: 'שלום {{customerName}}, רצינו להזכיר לכם:', vars: ['customerName'], multiline: true },
      { key: 'leadNoName', label: 'משפט פתיחה (כשאין שם)', default: 'רצינו להזכיר לכם:', multiline: true },
      { key: 'bannerLabel', label: 'כיתוב מעל התאריך', default: 'האירוע שלך {{whenWord}}', vars: ['whenWord'] },
      { key: 'lblOrder', label: 'תווית: מספר הזמנה', default: 'מספר הזמנה' },
      { key: 'lblItems', label: 'תווית: פריטים', default: 'פריטים' },
      { key: 'lblAddress', label: 'תווית: כתובת', default: 'כתובת' },
      { key: 'lblPhone', label: 'תווית: טלפון', default: 'טלפון' },
      { key: 'closing', label: 'משפט סיום', default: 'נשמח לראותכם!', multiline: true },
    ],
    schedule: {
      modes: ['days_before_event'],
      defaultDays: [1],
      maxDays: 30,
      note: 'נשלח מה-cron היומי (פעם ביום, ~08:30 שעון ישראל). אפשר לבחור כמה ימים לפני האירוע (גם כמה תזכורות, למשל 7 ו-1).',
    },
  },

  lateReturnReminder: {
    editable: true,
    enabled: { type: 'setting', key: 'late_return_email_enabled', note: 'אותה הגדרה קיימת: "מייל למאחרים" בהגדרות מערכת.' },
    subject: { default: 'תזכורת החזרה - הזמנה #{{orderId}}', vars: ['orderId'], note: 'התזכורת נשלחת פעם אחת להזמנה, לפי הנושא ביומן המיילים - שינוי הנושא לא יגרום לשליחה חוזרת (נבדקים הנושא הישן והחדש).' },
    vars: [V.customerName, V.orderId, { key: 'returnDate', label: 'תאריך ההחזרה', example: 'כז אלול תשפ"ו' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'תזכורת החזרה' },
      { key: 'title', label: 'כותרת', default: 'החזרה באיחור - הזמנה #{{orderId}}', vars: ['orderId'] },
      { key: 'lead', label: 'משפט פתיחה (כשיש שם)', default: 'שלום {{customerName}},', vars: ['customerName'], multiline: true },
      { key: 'calloutTitle', label: 'כותרת ההדגשה', default: 'ההחזרה טרם בוצעה' },
      { key: 'message', label: 'טקסט ההדגשה', default: 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.', multiline: true, bindSetting: 'late_return_email_text', hint: 'זהו אותו טקסט שמוגדר בהגדרות מערכת ("טקסט מייל איחור") - שינוי כאן משנה גם שם.' },
      { key: 'lblOrder', label: 'תווית: מספר הזמנה', default: 'מספר הזמנה' },
      { key: 'lblReturnDate', label: 'תווית: תאריך החזרה', default: 'תאריך החזרה' },
      { key: 'closing', label: 'משפט סיום', default: 'אם השמלות כבר הוחזרו, אפשר להתעלם מהודעה זו. לכל שאלה - אנחנו כאן.', multiline: true },
    ],
    schedule: {
      modes: ['days_after_return'],
      bindSetting: 'late_return_threshold_days',
      defaultDays: 7,
      maxDays: 90,
      note: 'נשלח מה-cron היומי, פעם אחת להזמנה, כשעברו N ימים מתאריך ההחזרה הצפוי והשמלות לא הוחזרו (אותה הגדרה "ימי איחור" שמשמשת את כל המערכת).',
    },
  },

  bulkEventDate: {
    editable: true,
    enabled: { type: 'setting', key: 'bulk_email_by_event_date', note: 'אותה הגדרה קיימת: "הודעה המונית לפי תאריך אירוע".' },
    subject: null, // הנושא מוקלד ע"י השולח + מזהה אצווה
    vars: [],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'הודעה חשובה' },
      { key: 'buttonLabel', label: 'כיתוב כפתור האישור', default: 'אישור קבלת ההודעה' },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשמנהל לוחץ שליחה במסך /admin/bulk-email (ראו גם לשונית "דיוורים" - דיוור חדש עם בחירת לקוחות, תמונה וצרופות).' },
  },

  refundExecuted: {
    editable: true,
    enabled: { type: 'override', note: 'כיבוי = לא נשלח מייל כשמסמנים זיכוי "בוצע" (הזיכוי עצמו מתבצע כרגיל).' },
    subject: { default: 'אישור ביצוע זיכוי - מערכת הגמ"ח', vars: [] },
    vars: [V.customerName, { key: 'amount', label: 'סכום הזיכוי', example: '₪1,250' }, V.orderId],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'אישור זיכוי' },
      { key: 'title', label: 'כותרת', default: 'הזיכוי בוצע' },
      { key: 'lead', label: 'משפט פתיחה (כשיש שם)', default: 'שלום {{customerName}}, בוצע עבורך זיכוי.', vars: ['customerName'], multiline: true },
      { key: 'leadNoName', label: 'משפט פתיחה (כשאין שם)', default: 'בוצע עבורך זיכוי.', multiline: true },
      { key: 'amountLabel', label: 'כיתוב מעל הסכום', default: 'סכום הזיכוי' },
      { key: 'lblOrder', label: 'תווית: מספר הזמנה', default: 'מספר הזמנה' },
      { key: 'lblBank', label: 'תווית: בנק', default: 'בנק' },
      { key: 'lblBranch', label: 'תווית: סניף', default: 'סניף' },
      { key: 'note', label: 'הערת הזמן', default: 'הזיכוי יועבר לחשבון הבנק שנמסר לנו. הזמן עד שהסכום מופיע בחשבון תלוי בבנק שלכם.', multiline: true },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשמסמנים את הזיכוי "בוצע".' },
  },

  dailyManagerReport: {
    editable: true,
    enabled: { type: 'setting', key: 'daily_manager_report_enabled', note: 'אותה הגדרה קיימת: "דוח יומי למנהל".' },
    // הנושא האמיתי ב-cron (app/api/cron/daily/route.js) - שונה מהרשומה הישנה בקטלוג, ר' docs/email-catalog.md
    subject: { default: 'דוח יומי {{hebrewDate}} - {{openedCount}} הזמנות חדשות אתמול, {{eventTodayCount}} עם אירוע היום', vars: ['hebrewDate', 'openedCount', 'eventTodayCount'], realSubject: true },
    vars: [V.hebrewDate, { key: 'openedCount', label: 'הזמנות חדשות שנפתחו אתמול', example: '4' }, { key: 'eventTodayCount', label: 'הזמנות עם אירוע היום', example: '3' }],
    lines: [
      { key: 'heading', label: 'כותרת הדוח', default: 'דוח יומי - {{hebrewDate}}', vars: ['hebrewDate'] },
      { key: 'lblOpened', label: 'כותרת: הזמנות חדשות', default: 'הזמנות חדשות שנפתחו אתמול:' },
      { key: 'lblEventToday', label: 'כותרת: אירועים היום', default: 'הזמנות עם אירוע היום:' },
      { key: 'none', label: 'כשאין הזמנות', default: 'אין' },
    ],
    schedule: { modes: ['daily'], note: 'נשלח פעם ביום מה-cron היומי (~08:30 שעון ישראל). שעה אחרת / כמה פעמים ביום דורשים cron נוסף (מגבלת Vercel Hobby: cron אחד ביום לכל משימה).' },
  },

  manualBarcodesReport: {
    editable: true,
    enabled: { type: 'setting', key: 'manual_barcode_daily_report', note: 'אותה הגדרה קיימת: "דוח יומי - ברקודים שהוקלדו ידנית".' },
    subject: { default: 'ברקודים ידניים {{hebrewDate}} - {{count}}', vars: ['hebrewDate', 'count'] },
    vars: [V.hebrewDate, { key: 'count', label: 'מספר הברקודים', example: '2' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'דוח ברקודים' },
      { key: 'title', label: 'כותרת', default: 'ברקודים שהוקלדו ידנית' },
      { key: 'lead', label: 'משפט פתיחה', default: 'הפריטים שנרשמו ללא סריקה ב-{{hebrewDate}}.', vars: ['hebrewDate'], multiline: true },
      { key: 'tileLabel', label: 'כיתוב אריח המספר', default: 'ברקודים ידניים' },
      { key: 'note', label: 'הערה בתחתית', default: 'ברקוד שהוקלד ידנית לא נסרק - כדאי לוודא שהפריט שנרשם בהזמנה הוא הפריט שנמסר בפועל.', multiline: true },
    ],
    schedule: { modes: ['daily'], note: 'נשלח פעם ביום מה-cron היומי, רק כשיש ברקודים ידניים.' },
  },

  internalMessageAlert: {
    editable: true,
    enabled: { type: 'override', note: 'כיבוי = לא נשלחים מיילים על הודעות פנימיות (ההודעה עצמה נשמרת ומוצגת במערכת כרגיל).' },
    subject: null, // כותרת ההודעה שהוקלדה
    vars: [],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'הודעה פנימית' },
      { key: 'lblFrom', label: 'תווית: מאת', default: 'מאת' },
      { key: 'footNote', label: 'הערה בתחתית', default: 'ההודעה המלאה זמינה גם במסך ההודעות במערכת.', multiline: true },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד עם שליחת ההודעה (רק לנמענים שסימנו קבלת התראות במייל).' },
  },

  courierDeliveries: {
    editable: true,
    enabled: { type: 'always', note: 'נשלח רק כשעובד לוחץ "שליחה במייל" ב"הדפסת משלוחים" (בכפוף להגדרות enable_deliveries + courier_email).' },
    subject: { default: 'נתוני משלוחים - {{groupCount}} קבוצות', vars: ['groupCount'], note: 'כשיש קבוצה אחת הנושא הוא כותרת הקבוצה (נקבע אוטומטית ואינו ניתן לעריכה).' },
    vars: [{ key: 'groupCount', label: 'מספר קבוצות המשלוח', example: '2' }],
    lines: [
      { key: 'kicker', label: 'תגית בכותרת', default: 'נתוני משלוחים' },
      { key: 'title', label: 'כותרת', default: 'נתוני משלוחים למשלוחן' },
      { key: 'lead', label: 'משפט פתיחה', default: 'רשימת הכתובות והטלפונים לחלוקה.', multiline: true },
      { key: 'tileDeliveries', label: 'כיתוב אריח: משלוחים', default: 'משלוחים' },
      { key: 'tileGroups', label: 'כיתוב אריח: קבוצות', default: 'קבוצות' },
      { key: 'empty', label: 'כשאין משלוחים', default: 'אין משלוחים בטווח/כיוון שנבחר.', multiline: true },
    ],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשהעובד לוחץ שליחה.' },
  },

  // --- מיילים טכניים (מתכנת / סוכן אוטומטי): מוצגים, נבדקים בתצוגה מקדימה, לא נערכים ---
  errorReportNew: {
    editable: false,
    enabled: { type: 'locked', note: 'דיווח תקלה למתכנתים - לא מכבים.' },
    subject: { default: 'דיווח תקלה ממערכת הגמח - לטיפול AI', vars: [] },
    vars: [], lines: [],
    schedule: { modes: ['immediate'], note: 'נשלח מיד עם הדיווח. הנושא והגוף נקראים על ידי הסוכן האוטומטי - נעולים לעריכה.' },
  },
  errorReportHumanRequested: {
    editable: false,
    enabled: { type: 'locked', note: 'מיידע את המתכנתים - לא מכבים.' },
    subject: { default: '{{reporterName}} מבקש/ת מענה אנושי - דיווח תקלה', vars: ['reporterName'] },
    vars: [{ key: 'reporterName', label: 'שם המדווח/ת', example: 'דנה לוי' }], lines: [],
    schedule: { modes: ['immediate'], note: 'נשלח מיד כשהמדווח מבקש מענה אנושי.' },
  },
  agentDigest: {
    editable: false,
    enabled: { type: 'setting', key: 'agent_digest_email_enabled', note: 'אותה הגדרה קיימת (גמ"ח ראשי בלבד).' },
    subject: { default: '{{count}} שינויים ממתינים לאישור מיזוג - מערכת הגמ"ח', vars: ['count'] },
    vars: [{ key: 'count', label: 'מספר שינויים', example: '2' }], lines: [],
    schedule: { modes: ['fixed'], note: 'נשלח פעמיים ביום מ-cron נפרד (~17:30 / ~00:30 שעון ישראל; לא בשבת/חג). השעות נקבעות ב-vercel.json ובהגדרה agent_digest_email_hours.' },
  },
  policyQuestionnaireSubmitted: {
    editable: false,
    enabled: { type: 'locked', note: 'המייל היחיד על תשובות השאלון - לא מכבים.' },
    subject: { default: 'שאלון מדיניות ביטולים וזיכויים - {{gmachName}} - {{respondentName}}', vars: ['respondentName'] },
    vars: [{ key: 'respondentName', label: 'שם המשיבה', example: 'דנה לוי' }], lines: [],
    schedule: { modes: ['immediate'], note: 'נשלח מיד בהגשת השאלון.' },
  },
});

/** מיילים שנשלחים מהמערכת אך אינם ברשומות הקטלוג הראשי (לתיעוד ולרשימה בלבד, לא ניתנים לעריכה). */
export const EXTRA_EMAILS = Object.freeze([
  {
    id: 'orderQuickMail',
    name: 'מייל מהיר מכרטיס הזמנה',
    category: 'customer',
    trigger: 'עובדת שולחת "מייל מהיר" מכרטיס ההזמנה החדש (נושא ותוכן חופשיים, צרופות לבחירה)',
    recipients: 'כתובת שהוקלדה בחלון (ברירת מחדל: מייל הלקוחה)',
    source: ['app/api/orders/[id]/email/route.js (body.quick)', 'lib/orderQuickMail.js'],
    gate: 'order_quick_mail_enabled',
    note: 'הנושא והתוכן מוקלדים ע"י העובדת. מסגרת העיצוב זהה ל"מייל חופשי" ואינה ניתנת לעריכה בנפרד.',
  },
  {
    id: 'backupFailure',
    name: 'כשל בגיבוי הנתונים',
    category: 'system',
    trigger: 'GitHub Actions - scripts/cloud_backup.js נכשל',
    recipients: 'המתכנתים + סוד BACKUP_ALERT_EMAIL',
    source: ['scripts/lib/backupAlert.js', '.github/workflows/backup-to-drive.yml'],
    gate: null,
    note: 'נשלח מחוץ לשרת האתר (סביבת GitHub) ולכן אין לו גישה לתבניות ולהגדרות כאן. נשאר קבוע.',
  },
]);

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

/** מזהי המיילים שניתנים לעריכה (editable) */
export function editableEmailIds() {
  return Object.keys(EMAIL_REGISTRY).filter((id) => EMAIL_REGISTRY[id].editable);
}

/** כל המשתנים המותרים בשורות/נושא של מייל (כולל המשותפים). */
export function allowedVarKeys(id) {
  const r = EMAIL_REGISTRY[id];
  if (!r) return [];
  return [...COMMON_VARS.map((v) => v.key), ...(r.vars || []).map((v) => v.key)];
}

/** ערכי דוגמה לכל משתני המייל (לתצוגה מקדימה). */
export function exampleVars(id) {
  const r = EMAIL_REGISTRY[id];
  const out = {};
  for (const v of COMMON_VARS) out[v.key] = v.example;
  for (const v of (r?.vars || [])) out[v.key] = v.example;
  return out;
}

/** ברירות המחדל של כל השורות: { key: default } */
export function defaultTexts(id) {
  const r = EMAIL_REGISTRY[id];
  const out = {};
  for (const l of (r?.lines || [])) out[l.key] = l.default;
  return out;
}

/**
 * בונה את פונקציית הטקסט של תבנית: tx('title', { orderId }) = הטקסט השמור (או ברירת המחדל) אחרי החלפת משתנים.
 * texts = מפת עקיפות { key: text } (יכולה להיות undefined). baseVars = משתנים שמשותפים לכל השורות (שם הגמ"ח וכו').
 * מפתח לא מוכר -> שגיאה מיידית (מונע שגיאת הקלדה בתבנית שהייתה מחזירה טקסט ריק בשקט).
 */
export function makeTx(emailId, texts, baseVars = {}) {
  const r = EMAIL_REGISTRY[emailId];
  if (!r) throw new Error(`emailRegistry: מייל לא מוכר "${emailId}"`);
  const defs = new Map(r.lines.map((l) => [l.key, l.default]));
  return (key, vars = {}) => {
    if (!defs.has(key)) throw new Error(`emailRegistry: שורה לא מוכרת "${key}" במייל "${emailId}"`);
    const override = texts && typeof texts[key] === 'string' ? texts[key] : undefined;
    return fillVars(override !== undefined ? override : defs.get(key), { ...baseVars, ...vars });
  };
}

/** הנושא של מייל: עקיפה שמורה > ברירת המחדל (תבנית הנושא ברישום). */
export function resolveSubject(emailId, subjectOverride, vars = {}) {
  const r = EMAIL_REGISTRY[emailId];
  const tpl = (typeof subjectOverride === 'string' && subjectOverride.trim()) ? subjectOverride : r?.subject?.default;
  return fillVars(tpl ?? '', vars, { subject: true });
}

/** "מחר" / "היום" / "מחרתיים" / "בעוד N ימים" - למשתנה whenWord של תזכורת האיסוף. */
export function whenWordForDays(days) {
  const n = Number(days);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === 2) return 'מחרתיים';
  return `בעוד ${n} ימים`;
}

// ---------------------------------------------------------------------------
// תזמון - מה קיים ומה מוגבל (מופיע גם במסך ובתיעוד):
//   * 'immediate'          - נשלח בתוך הבקשה שהפעילה אותו. אין תור/עיכוב (אין תשתית תורים; לא הוספנו).
//   * 'days_before_event'  - cron יומי: הזמנות שהאירוע שלהן בעוד N ימים (רשימת ימים).
//   * 'days_after_return'  - cron יומי: N ימים אחרי תאריך ההחזרה הצפוי (קשור ל-late_return_threshold_days).
//   * 'daily' / 'fixed'    - מיילי דוח ב-cron; השעה קבועה ב-vercel.json.
// cron של Vercel (תוכנית Hobby) מוגבל לריצה אחת ביום לכל משימה - לכן אין "שעה ביום" ואין "X דקות אחרי".
// ---------------------------------------------------------------------------
export const SCHEDULE_MODE_LABELS = Object.freeze({
  immediate: 'מיד (בזמן הפעולה)',
  days_before_event: 'ימים לפני האירוע',
  days_after_return: 'ימים אחרי תאריך ההחזרה',
  daily: 'פעם ביום (cron יומי)',
  fixed: 'שעות קבועות (cron)',
});
