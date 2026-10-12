// lib/aiGuide/areas/ops.targets.js - יעדי ההצבעה של כלי הניהול התפעוליים (נדרים פלוס, גיבויים, מיילים, מלאי, מחשבים מהימנים, חישובים, זיכויים,
// רשימות "כל ההזמנות" / "כל הלקוחות"). קובץ שנטען גם בדפדפן: רק נתונים, בלי imports של שרת.
// כל הדפים כאן הם דפי /admin/* (שער app/admin/layout.js: הנהלה ראשית / מתכנת), ולכן אין צורך ב-access.gate ביעדים - הזמינות נגזרת מהדף (ops.js).
// (12.10.2026: נוספו גם /station-analytics - שגם הוא מסך ניהול אך תחת הרשאת עמוד, ולא תחת /admin)
// ids: emc.* מרכז המיילים, brn.* ניהול סניפים, sa.* המרות בעמדה הציבורית, ned.* נדרים פלוס, bak.* גיבוי לדרייב, bulk.* מייל המוני, mail.* בדיקת מיילים, invalert.* התראות מלאי, td.* מחשבים מהימנים,
//      recalc.* חישובים מחדש, refpl.* / refsim.* / refpol.* זיכויים, bcinv.* ברקודים לא תקינים, ol.* רשימת ההזמנות, cl.* רשימת הלקוחות.

const NED = '/admin/nedarim-hok-list';

// --- רשימות הניהול (ol = כל ההזמנות, cl = כל הלקוחות): אותו מנוע רשימות (app/components/a5-list) ולכן אותם יעדים; ה-data-guide-id נבנה מ-guide="ol"/"cl" ---
function listTargets(p, route, what, nouns, filters) {
  const where = (s) => `ב${what}, ${s}`;
  return [
    { id: `${p}.back`, label: 'חץ חזרה למרכז הניהול', aliases: ['חזרה לניהול', 'חזרה למסך הניהול', 'חץ חזרה'], route, kind: 'button', where: where('חץ החזרה בפינה העליונה ליד הכותרת'), hint: 'חוזר למסך "כל כלי הניהול"' },
    { id: `${p}.search`, label: `חיפוש ${nouns.one}`, aliases: [`שדה חיפוש ${nouns.many}`, `חיפוש ב${nouns.many}`, 'תיבת חיפוש'], route, kind: 'field', where: where('שדה החיפוש בחצי הרוחב שמתחת לכותרת'), hint: nouns.searchHint },
    { id: `${p}.ai`, label: 'חיפוש חכם (AI)', aliases: ['חיפוש עם בינה מלאכותית', 'כוכב חיפוש חכם', 'לבקש מה-AI'], route, kind: 'icon', where: where('אייקון הניצוץ בתוך שדה החיפוש (לא מוצג כשתכונות ה-AI מוסתרות)'), hint: `מפעיל חיפוש חכם: כותבים בקשה חופשית והרשימה מסוננת בהתאם` },
    { id: `${p}.stats`, label: 'שאלות סטטיסטיקה', aliases: ['סטטיסטיקה על הרשימה', 'שאלות על הנתונים'], route, kind: 'icon', where: where('אייקון הגרף בתוך שדה החיפוש (לא מוצג כשתכונות ה-AI מוסתרות)'), hint: 'פותח חלון שאלות סטטיסטיקה על הנתונים' },
    { id: `${p}.filter`, label: 'סינון', aliases: ['לחצן סינון', 'מסננים', 'סנן', 'פילטר'], route, kind: 'button', where: where('הלחצן "סינון" בתוך שדה החיפוש (בצד שמאל שלו)'), hint: 'פותח את חלון הסינון, עם קבוצות ואפשרויות לבחירה' },
    ...filters.map((f) => ({
      id: `${p}.filter-${f.key}`, label: f.label, aliases: f.aliases, route, kind: 'section', where: where(`חלון "סינון", קבוצה "${f.label}"`), hint: f.hint,
      reveal: [{ click: `${p}.filter` }], parent: `${p}.filter`, ...(f.access ? { access: f.access } : {}),
    })),
    { id: `${p}.sort`, label: 'מיון', aliases: ['לחצן מיון', 'סדר', 'למיין', 'כיוון מיון'], route, kind: 'button', where: where('הלחצן "מיון" בסרגל התוצאות שמעל הרשימה'), hint: 'פותח בחירת שדה מיון וכיוון (עולה / יורד)' },
    { id: `${p}.view`, label: 'מתג שורות / טבלה', aliases: ['תצוגת טבלה', 'תצוגת שורות', 'מצב תצוגה'], route, kind: 'toggle', where: where('המתג הקטן בסרגל התוצאות: שורות או טבלה'), hint: 'מחליף בין תצוגת שורות לתצוגת טבלה עם עמודות' },
    { id: `${p}.export-excel`, label: 'ייצוא ל-Excel', aliases: ['אקסל', 'להוריד לאקסל', 'ייצוא לאקסל', 'הורדת אקסל'], route, kind: 'button', where: where('אייקון Excel הירוק בקצה סרגל התוצאות'), hint: `מייצא את ${nouns.exportWhat} (לפי החיפוש והסינון) לקובץ Excel` },
    { id: `${p}.export-download`, label: 'הורדה (PDF)', aliases: ['הורדת PDF', 'להוריד פי די אף', 'ייצוא ל-PDF', 'PDF'], route, kind: 'button', where: where('אייקון ההורדה בקצה סרגל התוצאות, ליד Excel'), hint: `מכין ${nouns.exportWhat} כקובץ PDF באותו עיצוב כמו ההדפסה` },
    { id: `${p}.export-print`, label: 'הדפסה', aliases: ['להדפיס את הרשימה', 'הדפסת הרשימה', 'הדפס'], route, kind: 'button', where: where('אייקון המדפסת בקצה סרגל התוצאות'), hint: `פותח תצוגה מקדימה להדפסת ${nouns.exportWhat}` },
  ];
}

const ORDER_FILTERS = [
  { key: 'states', label: 'סטטוס הזמנה', aliases: ['סינון לפי סטטוס', 'הזמנות מחוקות', 'הושכר', 'הוחזר', 'בקרוב'], hint: 'סטטוס: בקרוב, עבר, הושכר חלקי, הושכר, הוחזר חלקי, הוחזר, מחוק, טיוטה' },
  { key: 'pays', label: 'תשלום', aliases: ['סינון לפי חוב', 'הזמנות עם חוב', 'זיכוי ממתין', 'שולם במלואו'], hint: 'תשלום: חוב פתוח, זיכוי ממתין או שולם במלואו' },
  { key: 'delivery', label: 'משלוח', aliases: ['הזמנות עם משלוח', 'בלי משלוח'], hint: 'משלוח: עם משלוח או בלי' },
  { key: 'period', label: 'תאריך אירוע', aliases: ['סינון לפי תאריך', 'טווח תאריכים', 'אירוע היום', 'טווח מותאם'], hint: 'תאריך אירוע: היום, 7 ימים קרובים, 30 ימים אחרונים, שנה אחרונה, או "טווח מותאם" בלוח עברי' },
  { key: 'branches', label: 'סניף', aliases: ['סינון לפי סניף'], hint: 'סניף: מוצג רק כשהארגון עובד עם כמה סניפים', access: { setting: ['branches_enabled', 'true'] } },
];
const CUSTOMER_FILTERS = [
  { key: 'debt', label: 'חוב', aliases: ['לקוחות עם חוב', 'חוב פתוח'], hint: 'חוב: רק לקוחות עם חוב פתוח' },
  { key: 'missing', label: 'פרטים חסרים', aliases: ['חסרים שדות חובה', 'אין מייל', 'אין טלפון', 'אין תעודת זהות'], hint: 'פרטים חסרים: חסרים שדות חובה, אין מייל, אין טלפון או אין תעודת זהות' },
  { key: 'orders', label: 'הזמנות', aliases: ['לקוחות בלי הזמנות', 'עם הזמנות פעילות'], hint: 'הזמנות: עם הזמנות פעילות, עם הזמנות או בלי הזמנות' },
  { key: 'regs', label: 'תקנון', aliases: ['חתמו על התקנון', 'לא חתמו על התקנון'], hint: 'תקנון: מי חתם ומי לא חתם' },
  { key: 'blocked', label: 'חסימה', aliases: ['לקוחות חסומים'], hint: 'חסימה: חסומים מהזמנות חדשות או לא' },
  { key: 'first', label: 'לקוח חדש (הזמנה ראשונה)', aliases: ['לקוחות חדשים', 'הזמנה ראשונה'], hint: 'לקוח חדש = מי שהזמנתה הראשונה בתקופה (30 / 90 יום, שנה, או טווח מותאם)' },
];

export const targets = [
  // ===== רשימת "כל ההזמנות" (/admin/orders-list) =====
  ...listTargets('ol', '/admin/orders-list', 'רשימת "כל ההזמנות"', { one: 'הזמנה', many: 'הזמנות', exportWhat: 'רשימת ההזמנות', searchHint: 'מחפשים לפי מספר הזמנה, שם לקוחה, טלפון, ברקוד, דגם או תאריך עברי' }, ORDER_FILTERS),
  { id: 'ol.new', label: 'הזמנה חדשה', aliases: ['פתיחת הזמנה מהרשימה', 'להוסיף הזמנה'], route: '/admin/orders-list', kind: 'button', where: 'ברשימת "כל ההזמנות", בכותרת הכרטיס "רשימת הזמנות" (בצד שמאל)', hint: 'פותח הזמנה חדשה' },
  // ===== רשימת "כל הלקוחות" (/admin/customers-list) =====
  ...listTargets('cl', '/admin/customers-list', 'רשימת "כל הלקוחות"', { one: 'לקוח', many: 'לקוחות', exportWhat: 'רשימת הלקוחות', searchHint: 'מחפשים לפי שם, טלפון, מייל או עיר' }, CUSTOMER_FILTERS),
  { id: 'cl.new', label: 'לקוח חדש', aliases: ['פתיחת כרטיס לקוח', 'להוסיף לקוח'], route: '/admin/customers-list', kind: 'button', where: 'ברשימת "כל הלקוחות", בכותרת הכרטיס "רשימת לקוחות" (בצד שמאל)', hint: 'פותח טופס ללקוח חדש' },

  // ===== נדרים פלוס - הוראות קבע (/admin/nedarim-*) =====
  // שורת הניווט המשותפת מופיעה בראש כל חמשת הדפים; נרשמת פעם אחת (הדף הראשון) והיא זמינה בכולם
  { id: 'ned.nav-list', label: 'רשימת הוק', aliases: ['רשימת הוראות קבע', 'כל ההוראות קבע', 'רשימת הו"ק'], route: NED, kind: 'link', where: 'בראש כל דפי נדרים פלוס, שורת הכפתורים (הראשון)', hint: 'הרשימה של כל הוראות הקבע הפעילות' },
  { id: 'ned.nav-search', label: 'חיפוש בהוק', aliases: ['חיפוש הוראת קבע', 'לחפש הו"ק'], route: NED, kind: 'link', where: 'בראש כל דפי נדרים פלוס, שורת הכפתורים (השני)', hint: 'חיפוש הוראת קבע לפי מספר, שם, טלפון או ת.ז' },
  { id: 'ned.nav-edit', label: 'שינוי הו"ק', aliases: ['עריכת הוראת קבע', 'גביית תשלום בודד', 'לשנות הוק'], route: NED, kind: 'link', where: 'בראש כל דפי נדרים פלוס, שורת הכפתורים (השלישי)', hint: 'עריכת הוראה קיימת וגביית תשלום בודד' },
  { id: 'ned.nav-payments', label: 'תשלומים אחרונים', aliases: ['תשלומי נדרים', 'עסקאות אחרונות'], route: NED, kind: 'link', where: 'בראש כל דפי נדרים פלוס, שורת הכפתורים (הרביעי)', hint: 'היסטוריית עסקאות האשראי האחרונות' },
  { id: 'ned.nav-test', label: 'יצירת הוק (ניסוי)', aliases: ['יצירת הוראת קבע', 'הוק חדש'], route: NED, kind: 'link', where: 'בראש כל דפי נדרים פלוס, שורת הכפתורים (האחרון)', hint: 'דף ניסוי שיוצר הוראת קבע אמיתית' },
  { id: 'ned.list-totals', label: 'סיכום חודשי וצפי 12 חודשים', aliases: ['סה"כ חודשי', 'צפי הכנסות'], route: NED, kind: 'section', where: 'ברשימת הוראות הקבע, כרטיס הסיכום מעל הטבלה', hint: 'סכום חודשי של ההוראות הפעילות וצפי ל-12 חודשים' },
  { id: 'ned.list-table', label: 'טבלת הוראות הקבע', aliases: ['הרשימה של הו"ק', 'הוראות פעילות'], route: NED, kind: 'list', where: 'ברשימת הוראות הקבע, הטבלה (בכל שורה כפתור "עריכה")', hint: 'כל ההוראות הפעילות; בקצה כל שורה כפתור עריכה' },
  { id: 'ned.search-input', label: 'שדה חיפוש הוק', aliases: ['חיפוש לפי מספר הוק', 'חיפוש לפי שם או טלפון או ת.ז'], route: '/admin/nedarim-hok-search', kind: 'field', where: 'בדף "חיפוש בהוראות קבע", השדה הגדול בראש הדף', hint: 'מקלידים מספר הוק, שם, טלפון או ת.ז' },
  { id: 'ned.search-btn', label: 'חפש', aliases: ['כפתור חיפוש הוק'], route: '/admin/nedarim-hok-search', kind: 'button', where: 'בדף "חיפוש בהוראות קבע", הכפתור לצד שדה החיפוש', hint: 'מריץ את החיפוש' },
  { id: 'ned.edit-id', label: 'מספר הוק (KevaId)', aliases: ['מספר הוראת קבע', 'שדה מספר הוק'], route: '/admin/nedarim-hok-edit', kind: 'field', where: 'בדף "שינוי הו"ק", השדה העליון', hint: 'מקלידים את מספר ההוק לעריכה' },
  { id: 'ned.edit-load', label: 'טען', aliases: ['לטעון הוק', 'כפתור טען'], route: '/admin/nedarim-hok-edit', kind: 'button', where: 'בדף "שינוי הו"ק", הכפתור לצד שדה המספר', hint: 'טוען את פרטי ההוראה; אחרי הטעינה מופיעים טופס העריכה, הקפאה/מחיקה וגביית תשלום בודד' },
  { id: 'ned.pay-refresh', label: 'רענן', aliases: ['רענון תשלומים'], route: '/admin/nedarim-payments-recent', kind: 'button', where: 'בדף "תשלומים אחרונים", מעל הטבלה', hint: 'טוען מחדש את העסקאות (אין רענון אוטומטי, והמגבלה 20 פניות בשעה)' },
  { id: 'ned.pay-table', label: 'טבלת התשלומים האחרונים', aliases: ['עסקאות אחרונות', 'רשימת תשלומים'], route: '/admin/nedarim-payments-recent', kind: 'list', where: 'בדף "תשלומים אחרונים", הטבלה', hint: '50 העסקאות האחרונות: תאריך, שם, סכום, מס\' אישור' },

  // ===== גיבוי לדרייב (/admin/backups) =====
  { id: 'bak.auto-switch', label: 'מתג גיבוי אוטומטי', aliases: ['הפעלת גיבוי אוטומטי', 'כיבוי גיבוי', 'פעיל / כבוי'], route: '/admin/backups', kind: 'toggle', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי אוטומטי", המתג שליד המילה פעיל/כבוי', hint: 'מדליק או מכבה את הגיבוי האוטומטי (נשמר רק בלחיצה על "שמור הגדרות")' },
  { id: 'bak.interval', label: 'תדירות גיבוי', aliases: ['כל כמה זמן גיבוי', 'כל 6 שעות', 'כל 24 שעות'], route: '/admin/backups', kind: 'field', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי אוטומטי", כפתורי "כל 6 / 12 / 24 / 48 שעות" ושדה שעות מותאם', hint: 'בוחרים כל כמה שעות לגבות, או מקלידים מספר שעות מותאם' },
  { id: 'bak.drive-folder', label: 'שם תיקיית דרייב לגיבויים', aliases: ['תיקיית גיבוי', 'תיקיה בדרייב'], route: '/admin/backups', kind: 'field', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי אוטומטי"', hint: 'רשות: ריק = תיקיית ברירת מחדל שנוצרת אוטומטית' },
  { id: 'bak.owner-email', label: 'כתובת מייל לצפייה/הורדה של הגיבויים', aliases: ['מייל לגיבויים', 'למי משותפים הגיבויים'], route: '/admin/backups', kind: 'field', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי אוטומטי"', hint: 'קבצי הגיבוי משותפים רק לכתובת הזו' },
  { id: 'bak.save', label: 'שמור הגדרות', aliases: ['שמירת הגדרות גיבוי'], route: '/admin/backups', kind: 'button', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי אוטומטי", בתחתית', hint: 'שומר את הגדרות הגיבוי האוטומטי' },
  { id: 'bak.now', label: 'גבה עכשיו', aliases: ['גיבוי מיידי', 'גיבוי עכשיו', 'להריץ גיבוי'], route: '/admin/backups', kind: 'button', where: 'בדף "גיבוי לדרייב", כרטיס "גיבוי מיידי" (הכפתור הרחב)', hint: 'מריץ גיבוי מלא עכשיו; הריצה מופיעה ברשימה למטה תוך דקות' },
  { id: 'bak.history', label: 'היסטוריית גיבויים ולוג תקלות', aliases: ['לוג גיבויים', 'רשימת גיבויים', 'האם הגיבוי הצליח', 'להוריד גיבוי'], route: '/admin/backups', kind: 'section', where: 'בדף "גיבוי לדרייב", הכרטיס התחתון (60 הריצות האחרונות)', hint: 'כל ריצה: הצליח / נכשל, מתי, גודל, "הורדה מהדרייב" ו"פרטי השגיאה"' },

  // ===== שליחת מייל לפי תאריך אירוע (/admin/bulk-email) - פעיל רק כש-bulk_email_by_event_date='true' =====
  { id: 'bulk.from', label: 'מתאריך אירוע', aliases: ['תאריך אירוע', 'תאריך התחלה'], route: '/admin/bulk-email', kind: 'field', where: 'בדף "שליחת מייל לפי תאריך אירוע", בטופס, השדה הראשון', hint: 'תאריך האירוע (או תחילת הטווח) של הלקוחות שיקבלו את המייל', access: { setting: ['bulk_email_by_event_date', 'true'] } },
  { id: 'bulk.to', label: 'עד תאריך (אופציונלי)', aliases: ['סוף טווח', 'עד תאריך'], route: '/admin/bulk-email', kind: 'field', where: 'בדף "שליחת מייל לפי תאריך אירוע", בטופס, ליד "מתאריך אירוע"', hint: 'משאירים ריק לשליחה ליום אחד בלבד', access: { setting: ['bulk_email_by_event_date', 'true'] } },
  { id: 'bulk.subject', label: 'נושא', aliases: ['נושא המייל'], route: '/admin/bulk-email', kind: 'field', where: 'בדף "שליחת מייל לפי תאריך אירוע", בטופס', hint: 'נושא המייל', access: { setting: ['bulk_email_by_event_date', 'true'] } },
  { id: 'bulk.body', label: 'תוכן', aliases: ['תוכן המייל', 'גוף ההודעה'], route: '/admin/bulk-email', kind: 'field', where: 'בדף "שליחת מייל לפי תאריך אירוע", בטופס', hint: 'תוכן ההודעה; לכל מייל מתווסף קישור "אישור קבלת ההודעה"', access: { setting: ['bulk_email_by_event_date', 'true'] } },
  { id: 'bulk.send', label: 'שלח לכל האירועים בטווח', aliases: ['שליחת המייל', 'לשלוח דיוור'], route: '/admin/bulk-email', kind: 'button', where: 'בדף "שליחת מייל לפי תאריך אירוע", בתחתית הטופס', hint: 'שולח מייל לכל לקוחה עם אירוע בטווח; אחרי השליחה מופיעה טבלת מעקב ואישורים', access: { setting: ['bulk_email_by_event_date', 'true'] } },

  // ===== בדיקת מיילים (/admin/email-test) =====
  { id: 'mail.to', label: 'כתובת מייל לקבלת הדוגמאות', aliases: ['למי לשלוח את הבדיקה', 'כתובת לבדיקה'], route: '/admin/email-test', kind: 'field', where: 'בדף "בדיקת מיילים", הכרטיס העליון', hint: 'כל הדוגמאות נשלחות רק לכתובת הזו, לעולם לא ללקוחות אמיתיים' },
  { id: 'mail.send-selected', label: 'שלח את המסומנים', aliases: ['לשלוח דוגמאות', 'שליחת דוגמאות'], route: '/admin/email-test', kind: 'button', where: 'בדף "בדיקת מיילים", הכרטיס העליון, שורת הכפתורים', hint: 'שולח מייל דוגמה נפרד מכל סוג שסומן בטבלאות למטה', parent: 'mail.to' },
  { id: 'mail.preview-all', label: 'צפייה בכל 17 המיילים', aliases: ['תצוגה מקדימה של כל המיילים', 'לראות איך נראים המיילים'], route: '/admin/email-test', kind: 'button', where: 'בדף "בדיקת מיילים", הכרטיס העליון, שורת הכפתורים', hint: 'פותח חלון תצוגה של כל סוגי המיילים בלי לשלוח' },
  { id: 'mail.send-all', label: 'שלח את כולם במייל אחד (עם צרופות)', aliases: ['כל הדוגמאות במייל אחד'], route: '/admin/email-test', kind: 'button', where: 'בדף "בדיקת מיילים", הכרטיס העליון, שורת הכפתורים', hint: 'שולח הודעה אחת עם כל הדוגמאות והצרופות (צורך מכסת Gmail אחת בלבד)' },
  { id: 'mail.select-all', label: 'סמן הכל', aliases: ['בטל סימון הכל', 'סימון כל המיילים'], route: '/admin/email-test', kind: 'button', where: 'בדף "בדיקת מיילים", הכרטיס העליון, שורת הכפתורים', hint: 'מסמן או מבטל סימון של כל סוגי המיילים' },

  // ===== התראות מלאי (/admin/inventory-alerts) =====
  { id: 'invalert.table', label: 'טבלת חריגות המלאי', aliases: ['overbooking', 'חריגת מלאי', 'דגמים בחריגה', 'הזמנות מעורבות'], route: '/admin/inventory-alerts', kind: 'list', where: 'בדף "התראות ובדיקות מלאי", הטבלה (מוצגת רק כשיש חריגות)', hint: 'דגם, מידה, תאריכי חריגה, כמה במלאי וכמה הוזמן; "צפה בהזמנות" פותח את ההזמנות המעורבות' },

  // ===== מחשבים מהימנים (/admin/trusted-devices) =====
  { id: 'td.label', label: 'שם למחשב', aliases: ['כינוי למחשב', 'שם לעמדה'], route: '/admin/trusted-devices', kind: 'field', where: 'בדף "מחשבי מערכת מהימנים", כרטיס "סמן את המחשב הזה כמהימן" (לא מוצג אם המחשב כבר מהימן)', hint: 'שם אופציונלי, למשל "עמדה קדמית"' },
  { id: 'td.mark', label: 'סמן כמחשב מהימן', aliases: ['להגדיר מחשב כמהימן', 'כניסה מהירה ב-4 ספרות', 'מחשב מהימן'], route: '/admin/trusted-devices', kind: 'button', where: 'בדף "מחשבי מערכת מהימנים", כרטיס "סמן את המחשב הזה כמהימן" (לא מוצג אם המחשב כבר מהימן)', hint: 'מסמן את המחשב שאת עובדת עליו כרגע; מעכשיו נכנסים ממנו עם 4 התווים האחרונים של הסיסמה', parent: 'td.label' },
  { id: 'td.list', label: 'רשימת מחשבים מהימנים', aliases: ['מחשבים מהימנים', 'לבטל אמון במחשב', 'בטל אמון'], route: '/admin/trusted-devices', kind: 'list', where: 'בדף "מחשבי מערכת מהימנים", מתחת לכרטיס הסימון (בכל שורה כפתור "בטל אמון")', hint: 'כל המחשבים שסומנו, מי סימן ומתי; "בטל אמון" מחזיר את הצורך בסיסמה מלאה' },

  // ===== חישובים מחדש (/admin/recalculations) =====
  { id: 'recalc.from', label: 'תאריך התחלה (אירוע)', aliases: ['מתאריך', 'תחילת טווח'], route: '/admin/recalculations', kind: 'field', where: 'בדף "חישובים והתראות", כרטיס "סריקת פערים לפי טווח תאריכים"', hint: 'תחילת טווח תאריכי האירוע (בורר תאריך עברי)' },
  { id: 'recalc.to', label: 'תאריך סיום (אירוע)', aliases: ['עד תאריך', 'סוף טווח'], route: '/admin/recalculations', kind: 'field', where: 'בדף "חישובים והתראות", כרטיס "סריקת פערים לפי טווח תאריכים"', hint: 'סוף טווח תאריכי האירוע' },
  { id: 'recalc.search', label: 'חפש פערים', aliases: ['סריקת פערים', 'לחפש פערי תשלום'], route: '/admin/recalculations', kind: 'button', where: 'בדף "חישובים והתראות", כרטיס "סריקת פערים לפי טווח תאריכים"', hint: 'סורק את ההזמנות בטווח ומציג את אלה שהסכום שלהן שונה מהמחושב מחדש', parent: 'recalc.from' },

  // ===== זיכויים: תיעוד, מתכנן, סימולטור =====
  { id: 'refpl.nav', label: 'ניווט בין דפי הזיכויים', aliases: ['מתכנן כללים', 'סימולטור אמיתי', 'תיעוד המדיניות', 'לשוניות זיכויים'], route: '/admin/refund-policy', kind: 'tab', where: 'בראש שלושת דפי הזיכויים (מדיניות, מתכנן, סימולטור), שלושה כפתורים: "מתכנן כללים", "סימולטור אמיתי", "תיעוד המדיניות"', hint: 'מעבר בין התיעוד, המתכנן והסימולטור' },
  { id: 'refpol.toc', label: 'תוכן העניינים של המדיניות', aliases: ['בעמוד זה', 'שלוש המדרגות', 'ביטול מיידי', 'החלפת מידה'], route: '/admin/refund-policy', kind: 'section', where: 'בדף "מדיניות זיכויים וביטולים", הקופסה "בעמוד זה" בראש התוכן (קישורים לכל סעיף)', hint: 'קישורים לסעיפי התיעוד: המדרגות, תיקונים, ביטול מיידי, זיכוי על פריט חלופי, החלפת מידה ועוד' },
  { id: 'refpl.form', label: 'שדות המתכנן (הזמנה, כללים)', aliases: ['הגדרת כללי ביטול', 'פרמטרים של הזיכוי'], route: '/admin/refund-planner', kind: 'section', where: 'בדף "מתכנן זיכויים", העמודה הימנית (שדות למילוי: ימים בין ההזמנה לאירוע, מחיר, כללי המדרגות)', hint: 'ממלאים כמה ימים בין ההזמנה לאירוע ומחיר השמלה, ומשנים את הכללים' },
  { id: 'refpl.timeline', label: 'ציר הזמן של הזיכוי', aliases: ['פס הזיכוי', 'מה קורה אם מבטלים', 'גרירת המדרגות'], route: '/admin/refund-planner', kind: 'section', where: 'בדף "מתכנן זיכויים", הכרטיס הגדול שמשמאל "מה קורה אם מבטלים"', hint: 'גובה העמודה = כמה חוזר ללקוחה; גוררים את הכפתורים הצבעוניים כדי לשנות את הכללים' },
  { id: 'refpl.apply', label: 'החל בהגדרות המערכת', aliases: ['שמירת כללי הזיכוי', 'להחיל שינויים במדיניות'], route: '/admin/refund-planner', kind: 'button', where: 'בדף "מתכנן זיכויים", בתחתית העמודה הימנית', hint: 'שומר את הכללים ששונו בהגדרות המערכת; משפיע על כל חישוב זיכוי מרגע השמירה, בכל ההזמנות' },
  { id: 'refsim.order', label: 'ההזמנה (תאריך הזמנה ותאריך אירוע)', aliases: ['תאריכי ההזמנה בסימולטור', 'מתי בוצעה ההזמנה'], route: '/admin/refund-simulator', kind: 'section', where: 'בדף "סימולטור זיכויים אמיתי", העמודה הימנית, סעיף 1 "ההזמנה"', hint: 'מתי בוצעה ההזמנה ותאריך האירוע' },
  { id: 'refsim.add-item', label: 'הוסף שמלה', aliases: ['הוספת פריט לסימולציה', 'פריט חדש בסימולטור'], route: '/admin/refund-simulator', kind: 'button', where: 'בדף "סימולטור זיכויים אמיתי", העמודה הימנית, סעיף 3 "הפריטים"', hint: 'מוסיף שמלה להזמנה הדמיונית (קטגוריית מחיר, מידה, דגם, תיקונים, מתי נוספה ומתי בוטלה)' },
  { id: 'refsim.rules', label: 'הכללים בסימולטור', aliases: ['כללי הביטול בסימולטור', 'מה אם שינוי כללים'], route: '/admin/refund-simulator', kind: 'section', where: 'בדף "סימולטור זיכויים אמיתי", העמודה הימנית, סעיף 4 "הכללים"', hint: 'אפשר לשנות כאן כדי לבדוק "מה היה קורה אילו"; השינוי לא נשמר אלא אם לוחצים "החל בהגדרות המערכת"' },
  { id: 'refsim.apply', label: 'החל בהגדרות המערכת (סימולטור)', aliases: ['שמירת הכללים מהסימולטור'], route: '/admin/refund-simulator', kind: 'button', where: 'בדף "סימולטור זיכויים אמיתי", בתחתית העמודה הימנית', hint: 'שומר את הכללים ששונו בהגדרות המערכת, לכל ההזמנות' },

  // ===== ברקודים לא תקינים (/admin/barcode-invalid) - פעיל רק כש-barcode_invalid_list='true' =====
  { id: 'bcinv.table', label: 'טבלת הברקודים הלא תקינים', aliases: ['ברקוד לא תקין', 'סמן טופל', 'רשימת ברקודים שגויים'], route: '/admin/barcode-invalid', kind: 'list', where: 'בדף "ברקודים לא תקינים", הכרטיס עם הטבלה (בכל שורה ממתינה כפתור "סמן טופל")', hint: 'הזמנה, לקוחה, שמלה/ברקוד וסטטוס; "סמן טופל" מוריד את הברקוד מהרשימה', access: { setting: ['barcode_invalid_list', 'true'] } },

  // ===== מרכז המיילים (/admin/email-center): emc.* =====
  { id: 'emc.nav', label: 'לשוניות מרכז המיילים', aliases: ['קבוצות במרכז המיילים', 'נושאי מרכז המיילים'], route: '/admin/email-center', kind: 'section', where: 'במרכז המיילים, הרשימה בצד ימין (בטלפון: שורת לשוניות בראש המסך): מיילים, נתונים קבועים, דיוורים, בדיקה ויומן', hint: 'ארבע לשוניות: מיילים, נתונים קבועים, דיוורים, בדיקה ויומן' },
  { id: 'emc.tab-emails', label: 'מיילים', aliases: ['רשימת המיילים', 'עריכת מיילים', 'ניסוח מיילים'], route: '/admin/email-center', kind: 'tab', parent: 'emc.nav', where: 'במרכז המיילים, הלשונית הראשונה "מיילים"', hint: 'כל המיילים שהמערכת שולחת, עם הפעלה/כיבוי ועריכה' },
  { id: 'emc.tab-fixed', label: 'נתונים קבועים', aliases: ['שם הגמ"ח במייל', 'חתימה במייל', 'לוגו במייל', 'כתובת וטלפון במייל', 'שורת סיום'], route: '/admin/email-center', kind: 'tab', parent: 'emc.nav', where: 'במרכז המיילים, הלשונית "נתונים קבועים"', hint: 'הנתונים שמופיעים בכל מייל: שם הגמ"ח, כתובת, טלפון, לוגו, חתימה' },
  { id: 'emc.tab-campaigns', label: 'דיוורים', aliases: ['דיוור', 'שליחת מייל לכמה לקוחות', 'מייל שיווקי', 'מייל לרשימת תפוצה'], route: '/admin/email-center', kind: 'tab', parent: 'emc.nav', where: 'במרכז המיילים, הלשונית "דיוורים"', hint: 'שליחת מייל אחד לקבוצת לקוחות שאישרו דיוור' },
  { id: 'emc.tab-tools', label: 'בדיקה ויומן', aliases: ['יומן מיילים', 'בדיקת מיילים', 'מתי רצים המיילים'], route: '/admin/email-center', kind: 'tab', parent: 'emc.nav', where: 'במרכז המיילים, הלשונית "בדיקה ויומן"', hint: 'קישורים לשליחת מיילי דוגמה וליומן המיילים' },
  { id: 'emc.list', label: 'רשימת המיילים לפי קטגוריה', aliases: ['כל המיילים שהמערכת שולחת', 'אישור הזמנה', 'תזכורת איסוף', 'מייל למאחרים'], route: '/admin/email-center', kind: 'list', reveal: [{ click: 'emc.tab-emails' }], parent: 'emc.tab-emails', where: 'במרכז המיילים, בלשונית "מיילים": כרטיס לכל קטגוריה ובו שורה לכל מייל (שם, מתי נשלח, למי ותזמון)', hint: 'שורה לכל מייל, עם מתג הפעלה וכפתור עריכה' },
  { id: 'emc.row-toggle', label: 'מתג הפעלה / כיבוי של מייל', aliases: ['להפעיל מייל', 'לכבות מייל', 'כיבוי מייל אוטומטי'], route: '/admin/email-center', kind: 'toggle', reveal: [{ click: 'emc.tab-emails' }], parent: 'emc.list', where: 'במרכז המיילים, בלשונית "מיילים", בקצה השורה של כל מייל (מיילים שנשלחים תמיד או לפי פעולה מציגים תווית במקום מתג)', hint: 'מדליק או מכבה את המייל' },
  { id: 'emc.row-edit', label: 'עריכה', aliases: ['לערוך מייל', 'לשנות ניסוח של מייל', 'פתיחת עורך המייל', 'תצוגה'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-emails' }], parent: 'emc.list', where: 'במרכז המיילים, בלשונית "מיילים", הכפתור "עריכה" בשורה של כל מייל (למיילים טכניים: "תצוגה")', hint: 'פותח את עורך המייל: נושא, שורות, תזמון ותצוגה מקדימה' },
  { id: 'emc.editor-back', label: 'חזרה לרשימת המיילים', aliases: ['יציאה מעורך המייל'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, בראש העורך', hint: 'חוזר לרשימת המיילים (אם יש שינויים שלא נשמרו מוצג חלון אישור)' },
  { id: 'emc.editor-toggle', label: 'מופעל', aliases: ['הפעלת המייל בעורך'], route: '/admin/email-center', kind: 'toggle', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, בכרטיס הראשון ("מתי נשלח ולמי"), השורה "מופעל"', hint: 'מדליק או מכבה את המייל' },
  { id: 'emc.subject', label: 'נושא המייל', aliases: ['לשנות נושא למייל', 'כותרת המייל', 'שדות מוחלפים בנושא'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, הכרטיס "נושא המייל" (שדות מוחלפים כמו שם הלקוחה ומספר ההזמנה נכנסים כצ׳יפים)', hint: 'כותבים נושא; שדות מוחלפים נוספים מהלוח שמתחת' },
  { id: 'emc.lines', label: 'שורות המייל', aliases: ['ניסוח המייל', 'טקסט המייל', 'לשנות שורה במייל', 'חזרה לברירת מחדל של שורה'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, הכרטיס "שורות המייל": שדה לכל שורה, עם חץ לאיפוס שורה בודדת לברירת המחדל', hint: 'עורכים כל שורה בנפרד; מייל שלא נערך יוצא כמו תמיד' },
  { id: 'emc.schedule', label: 'תזמון השליחה', aliases: ['מתי נשלח המייל', 'כמה ימים לפני האירוע', 'מייל אחרי X ימים', 'ימי תזכורת'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, הכרטיס "תזמון השליחה" (רק למיילים שמאפשרים תזמון: מיד / אחרי X ימים מההזמנה, X ימים לפני האירוע, X ימים אחרי ההחזרה)', hint: 'קובעים מתי המייל נשלח' },
  { id: 'emc.preview', label: 'תצוגה מקדימה', aliases: ['איך המייל ייראה', 'תצוגה מקדימה של מייל'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, העמודה בצד (בטלפון: מתחת) עם התצוגה המקדימה החיה', hint: 'מראה איך המייל ייראה עם הנתונים לדוגמה' },
  { id: 'emc.editor-save', label: 'שמירה', aliases: ['שמירת המייל', 'לשמור שינויים במייל'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, בתחתית העורך (פעיל רק אחרי שינוי)', hint: 'שומר את הנושא, השורות והתזמון' },
  { id: 'emc.editor-reset', label: 'איפוס המייל לברירת מחדל', aliases: ['להחזיר מייל לניסוח המקורי', 'ביטול כל השינויים במייל'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-emails' }, { click: 'emc.row-edit' }, { wait: 300 }], parent: 'emc.row-edit', where: 'בעורך של מייל, בתחתית העורך בצד שמאל (מבקש אישור)', hint: 'מוחק את הנושא, השורות והתזמון שנערכו ומחזיר את הניסוח המקורי' },
  { id: 'emc.fixed', label: 'נתונים קבועים בכל מייל', aliases: ['שדות קבועים', 'שם הגמ"ח במיילים', 'חתימת המיילים', 'לוגו במיילים', 'בס"ד במייל'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-fixed' }], parent: 'emc.tab-fixed', where: 'במרכז המיילים, בלשונית "נתונים קבועים": שדה לכל נתון (עם חץ לאיפוס לברירת המחדל) ותצוגה מקדימה בצד', hint: 'ערכים שמופיעים בכל המיילים' },
  { id: 'emc.fixed-save', label: 'שמירה', aliases: ['שמירת נתונים קבועים'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-fixed' }], parent: 'emc.fixed', where: 'בלשונית "נתונים קבועים", בתחתית הכרטיס (פעיל רק אחרי שינוי)', hint: 'שומר את הנתונים הקבועים' },
  { id: 'emc.fixed-reset', label: 'איפוס כל הנתונים הקבועים', aliases: ['להחזיר נתונים קבועים לברירת מחדל'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-fixed' }], parent: 'emc.fixed', where: 'בלשונית "נתונים קבועים", בתחתית הכרטיס בצד שמאל (מבקש אישור)', hint: 'מחזיר את כל השדות לערכי הגמ"ח מהגדרות האתר או לברירת המחדל' },
  { id: 'emc.camp-who', label: 'למי לשלוח', aliases: ['נמעני הדיוור', 'בחירת נמענים לדיוור', 'לפי עיר', 'לפי תאריך אירוע', 'בחירה ידנית של לקוחות'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.tab-campaigns', where: 'במרכז המיילים, בלשונית "דיוורים", הכרטיס "למי לשלוח": כל מאשרי הדיוור / לפי עיר / לפי תאריך אירוע / בחירה ידנית', hint: 'נמענים הם רק לקוחות שאישרו קבלת דיוורים' },
  { id: 'emc.camp-content', label: 'תוכן הדיוור', aliases: ['נושא ותוכן לדיוור', 'תמונה בדיוור', 'צרופות לדיוור', 'כפתור בדיוור'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.tab-campaigns', where: 'בלשונית "דיוורים", הכרטיס "תוכן הדיוור": נושא, כותרת, תוכן, תמונה, כפתור וקבצים מצורפים (עד 5)', hint: 'כותבים את הדיוור; שדות אישיים נכנסים כצ׳יפים' },
  { id: 'emc.camp-send', label: 'שליחה', aliases: ['שליחה מיידית', 'שליחה מתוזמנת', 'לתזמן דיוור'], route: '/admin/email-center', kind: 'section', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.tab-campaigns', where: 'בלשונית "דיוורים", הכרטיס "שליחה": שליחה מיידית או מתוזמנת (תאריך בלוח העברי ושעה)', hint: 'בוחרים מיידי או מתוזמן' },
  { id: 'emc.camp-test', label: 'שליחת בדיקה לעצמי', aliases: ['מייל בדיקה לדיוור', 'לבדוק דיוור לפני שליחה'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.camp-send', where: 'בלשונית "דיוורים", הכרטיס "שליחה", הכפתור הראשון', hint: 'שולח לך את הדיוור בלבד, כדי לראות איך הוא נראה' },
  { id: 'emc.camp-go', label: 'שליחת הדיוור', aliases: ['תזמון הדיוור', 'לשלוח את הדיוור', 'כפתור שליחה לדיוור'], route: '/admin/email-center', kind: 'button', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.camp-send', where: 'בלשונית "דיוורים", הכרטיס "שליחה", הכפתור הראשי (נקרא "תזמון הדיוור" כשנבחרה שליחה מתוזמנת; מבקש אישור)', hint: 'שולח או מתזמן את הדיוור לנמענים שנבחרו' },
  { id: 'emc.camp-history', label: 'דיוורים אחרונים', aliases: ['היסטוריית דיוורים', 'ביטול דיוור מתוזמן', 'מה נשלח בדיוור'], route: '/admin/email-center', kind: 'list', reveal: [{ click: 'emc.tab-campaigns' }], parent: 'emc.tab-campaigns', where: 'בלשונית "דיוורים", הכרטיס התחתון "דיוורים אחרונים" (לדיוור מתוזמן יש כפתור "ביטול")', hint: 'טבלת הדיוורים האחרונים וסטטוס כל אחד' },
  { id: 'emc.tools-test', label: 'שליחת מיילי דוגמה', aliases: ['בדיקת מיילים מהמרכז'], route: '/admin/email-center', kind: 'link', reveal: [{ click: 'emc.tab-tools' }], parent: 'emc.tab-tools', where: 'במרכז המיילים, בלשונית "בדיקה ויומן", השורה "שליחת מיילי דוגמה", הכפתור "פתיחה"', hint: 'פותח את דף בדיקת המיילים' },
  { id: 'emc.tools-logs', label: 'יומן המיילים שנשלחו', aliases: ['לוג מיילים מהמרכז'], route: '/admin/email-center', kind: 'link', access: { gate: 'prog' }, reveal: [{ click: 'emc.tab-tools' }], parent: 'emc.tab-tools', where: 'במרכז המיילים, בלשונית "בדיקה ויומן", השורה "יומן המיילים שנשלחו" (למתכנת בלבד)', hint: 'פותח את יומן שליחת המיילים' },

  // ===== ניהול סניפים (/admin/branches): brn.* =====
  { id: 'brn.enable', label: 'הפעלת ריבוי סניפים', aliases: ['ריבוי סניפים', 'להפעיל סניפים', 'כיבוי ריבוי סניפים', 'מתג סניפים'], route: '/admin/branches', kind: 'toggle', where: 'בדף "סניפים", בכרטיס העליון: הכפתור "הפעלת ריבוי סניפים" (או "כיבוי ריבוי סניפים" כשהוא פעיל; מבקש אישור)', hint: 'ברירת המחדל כבויה: אז המערכת עובדת כמו תמיד, בלי שיוך סניף לפריטים' },
  { id: 'brn.list', label: 'רשימת הסניפים', aliases: ['הסניפים', 'סניף ראשי', 'אילו סניפים יש'], route: '/admin/branches', kind: 'list', where: 'בדף "סניפים", הכותרת "הסניפים" וכרטיס לכל סניף מתחתיה', hint: 'כל סניף עם שם, סימון ראשי, מה יש בו ומתג פעיל' },
  { id: 'brn.name', label: 'שם הסניף', aliases: ['לשנות שם סניף', 'לקרוא לסניף'], route: '/admin/branches', kind: 'field', parent: 'brn.list', where: 'בדף "סניפים", בכרטיס של כל סניף (נעול כשכבר יש עליו הזמנות או פריטים; אז משביתים ומוסיפים סניף חדש)', hint: 'שם הסניף כפי שיוצג בפריטים ובהזמנות' },
  { id: 'brn.main', label: 'סניף ראשי', aliases: ['הסניף הראשי', 'לקבוע סניף ראשי'], route: '/admin/branches', kind: 'field', parent: 'brn.list', where: 'בדף "סניפים", בכרטיס של כל סניף: כפתור הבחירה "סניף ראשי" (רק סניף פעיל אחד יכול להיות ראשי)', hint: 'סניף ראשי אחד בלבד מבין הפעילים' },
  { id: 'brn.caps', label: 'מה יש בסניף', aliases: ['מדידה איסוף והחזרה', 'יכולות הסניף', 'האם אפשר למדוד בסניף', 'איסוף והחזרה בסניף'], route: '/admin/branches', kind: 'section', parent: 'brn.list', where: 'בדף "סניפים", בכרטיס של כל סניף: שלושה סימונים - מדידה, איסוף, החזרה', hint: 'מסמנים אילו פעולות אפשריות בסניף' },
  { id: 'brn.add', label: 'הוספת סניף', aliases: ['סניף חדש', 'להוסיף סניף'], route: '/admin/branches', kind: 'button', where: 'בדף "סניפים", מתחת לרשימת הסניפים', hint: 'מוסיף כרטיס סניף חדש (עד המספר המרבי שמותר)' },
  { id: 'brn.notices', label: 'התראות על העברת פריטים בין סניפים', aliases: ['פס התראות העברה', 'טווח התראת העברה', 'התראת החזרה לסניף אחר'], route: '/admin/branches', kind: 'section', access: { setting: ['multi_branch_enabled', 'true'] }, where: 'בדף "סניפים", הכותרת "התראות על העברת פריטים בין סניפים" (מוצגת רק כשריבוי הסניפים פעיל)', hint: 'פס בראש הדף, טווח בימים והתראה בסריקת החזרה' },
  { id: 'brn.reserve', label: 'פריטי רזרבה', aliases: ['התראת רזרבה', 'החזרה לרזרבה', 'יציאה מהרזרבה'], route: '/admin/branches', kind: 'section', where: 'בדף "סניפים", הכותרת "פריטי רזרבה" בתחתית הדף', hint: 'התראה בסריקת החזרה של פריט רזרבה שיצא באישור' },
  { id: 'brn.save', label: 'שמירה', aliases: ['שמירת הסניפים', 'לשמור שינויים בסניפים'], route: '/admin/branches', kind: 'button', where: 'בדף "סניפים", בתחתית הדף (פעיל רק אחרי שינוי; ליד "ביטול שינויים")', hint: 'שומר את רשימת הסניפים וההגדרות' },

  // ===== המרות בעמדה הציבורית (/station-analytics): sa.* =====
  { id: 'sa.filters', label: 'סינון התקופה והערוץ', aliases: ['תקופה', 'היום 7 ימים 30 ימים', 'ערוץ', 'עמדה ציבורית או בחנות', 'חלון המרה'], route: '/station-analytics', kind: 'section', where: 'במסך "המרות בעמדה", הסרגל שמתחת לכותרת: תקופה (היום / 7 / 30 ימים / טווח בלוח), ערוץ (קישור ציבורי / עמדה בחנות / הכל) וחלון ההמרה בימים', hint: 'בוחרים תקופה, ערוץ וחלון המרה' },
  { id: 'sa.refresh', label: 'רענון', aliases: ['לרענן מדדים'], route: '/station-analytics', kind: 'button', parent: 'sa.filters', where: 'במסך "המרות בעמדה", בקצה סרגל הסינון', hint: 'טוען את המדדים מחדש' },
  { id: 'sa.nav', label: 'קטעי המסך', aliases: ['ניווט במסך ההמרות'], route: '/station-analytics', kind: 'section', where: 'במסך "המרות בעמדה", הרשימה בצד ימין (בטלפון: שורת לשוניות)', hint: 'קופצים לקטע: סיכום, משפך, לאורך זמן, רישומים, איך סופרים' },
  { id: 'sa.sec-sum', label: 'סיכום להיום', aliases: ['כמה נכנסו היום', 'נכנסו לעמדה', 'מילאו פרטים', 'נפתחה הזמנה'], route: '/station-analytics', kind: 'section', parent: 'sa.nav', where: 'במסך "המרות בעמדה", הקטע הראשון "היום": ריבועי מדדים (נכנסו, מילאו פרטים, נפתחה הזמנה, הזמנה אושרה או שולמה) מול אתמול וממוצע שבועי', hint: 'המדדים של היום' },
  { id: 'sa.sec-funnel', label: 'משפך ההמרה', aliases: ['אחוזי המרה', 'כמה אחוז סגרו הזמנה', 'משפך'], route: '/station-analytics', kind: 'section', parent: 'sa.nav', where: 'במסך "המרות בעמדה", הקטע "משפך ההמרה"', hint: 'מכניסות עד הזמנה שאושרה, עם אחוזים' },
  { id: 'sa.sec-daily', label: 'לאורך זמן', aliases: ['גרף יומי', 'מגמות בעמדה', 'מדדים לפי יום'], route: '/station-analytics', kind: 'section', parent: 'sa.nav', where: 'במסך "המרות בעמדה", הקטע "לאורך זמן": גרפים לפי יום', hint: 'לחיצה על יום מציגה את הרישומים שלו' },
  { id: 'sa.sec-regs', label: 'הרישומים', aliases: ['מי נרשמה בעמדה', 'רשימת הרשומות', 'לקוחות שמילאו פרטים בעמדה'], route: '/station-analytics', kind: 'list', parent: 'sa.nav', where: 'במסך "המרות בעמדה", הקטע "הרישומים של היום": שם פרטי ואות ראשונה בלבד (שמות מלאים רק עם הרשאת לקוחות)', hint: 'מי מילאה פרטים ביום שנבחר' },
  { id: 'sa.sec-how', label: 'איך סופרים', aliases: ['הסבר על המדדים', 'מה נספר כהמרה', 'הגדרות המדדים'], route: '/station-analytics', kind: 'section', parent: 'sa.nav', where: 'במסך "המרות בעמדה", הקטע האחרון "איך סופרים"', hint: 'ההסבר מה נספר בכל מדד' },
];

// data-guide-id דינמי (תבנית בקוד): הקידומת חייבת להופיע בקובץ
export const dynamic = [
  { prefix: 'emc.tab-', file: 'app/components/email-center/EmailCenterPage.js' },
  { prefix: 'sa.sec-', file: 'app/components/station-analytics/StationAnalyticsPage.js' },
  { prefix: 'ned.nav-', file: 'app/admin/_nedarim/NedarimNav.js' },
  { prefix: 'ol.', file: 'app/components/a5-list/A5List.js' },
  { prefix: 'ol.', file: 'app/components/a5-list/A5Parts.js' },
  { prefix: 'ol.', file: 'app/components/a5-list/A5ListPage.js' },
  { prefix: 'cl.', file: 'app/components/a5-list/A5List.js' },
  { prefix: 'cl.', file: 'app/components/a5-list/A5Parts.js' },
  { prefix: 'cl.', file: 'app/components/a5-list/A5ListPage.js' },
  { prefix: 'refpl.apply', file: 'app/admin/refund-planner/shared.js' },
  { prefix: 'refsim.apply', file: 'app/admin/refund-planner/shared.js' },
];
